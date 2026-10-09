import {materialCode,normalize,queryTokens,formatPrefix,type CatalogData,type Summary,type VehicleData} from "./fleet.ts";
import {interpretQuery,executeQueryPlan} from "./query-engine.ts";
import {analyzeStock,sheetRecords,VALIDATION_VERSION,type SearchItem,type SearchSnapshot,type SourceMode,type StockRecord,type HumanNote} from "./validated-search.ts";
import {normalizeOperationalPrefix} from "./import-pipeline.ts";
import {digest} from "./query-journal.ts";

type Manifest={version:string;file:string;vehicleHashes:Record<string,string>};
async function asset<T>(assets:Fetcher,path:string):Promise<T>{
 if(!assets)throw new Error("Fonte de dados indisponível.");
 const response=await assets.fetch(new Request(`https://jarvis-assets.invalid/data/${path}`));
 if(!response.ok)throw new Error("Não foi possível ler a fonte de dados.");
 return response.json() as Promise<T>;
}
export async function createSearchContext(owner:string,sourceMode:SourceMode,assets:Fetcher,db:D1Database){
 const [summary,catalog,manifest]=await Promise.all([asset<Summary>(assets,"summary.json"),asset<CatalogData>(assets,"catalog.json"),asset<Manifest>(assets,"source-manifest.json")]);
 const cache=new Map<string,Promise<{data:VehicleData;records:StockRecord[];version:string}>>();
 const getVehicle=(prefix:string)=>{
  if(!cache.has(prefix))cache.set(prefix,(async()=>{
   const code=String(Number(prefix)-55000),profile=summary.fleet.find(r=>r.code===code);
   const empty:VehicleData={code,year:profile?.year||null,brand:profile?.brand||null,model:profile?.model||null,plate:profile?.plate||null,parts:[],services:[]};
   if(sourceMode==="csv"){
    const rows=(await db.prepare(`SELECT m.*,j.file_name FROM maintenance m LEFT JOIN import_jobs j ON j.id=m.import_job_id AND j.owner_id=m.owner_id WHERE m.owner_id=? AND m.prefix=? ORDER BY m.date DESC,m.id DESC LIMIT 20001`).bind(owner,prefix).all<Record<string,unknown>>()).results;
    if(rows.length>20000)throw new Error("O prefixo excede o limite de consulta complementar. Refine a base antes de consultar.");
    const records:StockRecord[]=rows.map(r=>({id:`CSV-${r.id}`,source:String(r.source),sourceFile:String(r.source_file||r.file_name||""),sourceLine:typeof r.source_line==="number"?r.source_line:null,document:r.source_record_id&&!String(r.source_record_id).startsWith("AUTO-")?String(r.source_record_id):null,prefix,part:String(r.part),family:"",code:materialCode(String(r.part)),date:String(r.date),time:r.time?String(r.time):null,km:typeof r.km==="number"?r.km:null,quantity:typeof r.quantity==="number"?r.quantity:null,responsible:r.mechanic?String(r.mechanic):null,workOrder:r.work_order?String(r.work_order):null,movement:String(r.movement_type||"unknown"),explicitIssue:r.movement_evidence==="explicit"&&r.movement_type==="issue",note:r.notes?String(r.notes):null}));
    return {data:empty,records,version:await digest(JSON.stringify(records))};
   }
   if(!profile)return {data:empty,records:[],version:manifest.version};
   const data=await asset<VehicleData>(assets,`${code}.json`);
   return {data,records:sheetRecords(data,manifest.file),version:manifest.version+":"+(manifest.vehicleHashes[code]||"unknown")};
  })());return cache.get(prefix)!;
 };
 const getHumanNotes=async(prefix:string,part:string):Promise<HumanNote[]>=>{
  if(!db)return [];
  const rows=(await db.prepare(`SELECT e.id,e.subject_id,e.kind,e.actor,e.created_at,e.payload FROM audit_events e JOIN query_history q ON q.id=e.subject_id AND q.owner_id=e.owner_id WHERE e.owner_id=? AND q.prefix=? AND q.part=? AND q.source_mode=? AND e.kind IN ('confirm','correction') ORDER BY e.created_at DESC,e.id DESC LIMIT 10`).bind(owner,prefix,part,sourceMode).all<{id:string;subject_id:string;kind:string;actor:string;created_at:string;payload:string}>()).results;
  return rows.map(r=>({id:r.id,queryId:r.subject_id,kind:r.kind,actor:r.actor,createdAt:r.created_at,note:String(JSON.parse(r.payload).note||'')}));
 };
 return {summary,catalog,manifest,getVehicle,getHumanNotes};
}

async function executeSearchItemInternal(item:SearchItem,context:Awaited<ReturnType<typeof createSearchContext>>,options:{sourceMode:SourceMode;recentDays:number;runId:string}):Promise<SearchSnapshot>{
 let prefix=normalizeOperationalPrefix(item.prefix),part=item.part;
 const plan=item.kind==="query"?interpretQuery(item.query||item.part,context.summary,context.catalog):null;
 if(plan){prefix=plan.prefix?formatPrefix(plan.prefix):prefix;part=plan.standardizedPartName||plan.materialCode||queryTokens(plan.raw).join(" ")||"Consulta de registros";}
 const effective={...item,prefix:prefix||item.prefix||"Não identificado",part};
 if(plan?.issues?.length){const base=analyzeStock(effective,[],context.catalog,{...options,knownVehicle:true,sourceVersion:context.manifest.version});base.status='inconclusive';base.needsReview=true;base.explanation='Os critérios precisam de revisão antes de consultar os registros.';base.warnings=plan.issues;base.queryDomain=plan.domain;return base;}
 if(!prefix)return analyzeStock(effective,[],context.catalog,{...options,knownVehicle:false,sourceVersion:context.manifest.version});
 const {data,records,version}=await context.getVehicle(prefix);
 const known=context.summary.fleet.some(r=>formatPrefix(r.code)===prefix)||(options.sourceMode==="csv"&&records.length>0);
 if(plan&&(plan.domain==='services'||plan.ficha)&&options.sourceMode==='csv'){
  const base=analyzeStock(effective,[],context.catalog,{...options,knownVehicle:known,sourceVersion:version});
  base.queryDomain='services';base.status='inconclusive';base.needsReview=true;base.explanation='O CSV complementar não possui a estrutura da LISTAGEM GERAL necessária para confirmar serviços ou fichas. Selecione Base integrada para esta consulta.';return base;
 }
 let selected=records;if(plan?.os)selected=selected.filter(r=>r.workOrder===plan.os);
 if(plan?.period)selected=selected.filter(r=>(!plan.period?.from||r.date>=plan.period.from)&&(!plan.period?.to||r.date<=plan.period.to));
 if(plan&&(plan.domain==="services"||plan.ficha||(!plan.standardizedPartId&&!plan.materialCode&&plan.os))&&options.sourceMode==="sheets"){
  const found=executeQueryPlan(data,plan,context.catalog);
  if(plan.domain==="services"||plan.ficha){
   const s=found.services[0]?.row;const base=analyzeStock(effective,[],context.catalog,{...options,knownVehicle:known,sourceVersion:version});
   base.queryDomain='services';base.status=s?"service_found":"not_found";base.explanation=s?"Serviço localizado. Este registro não comprova a saída de uma peça.":"Nenhum serviço correspondente à consulta.";base.matchedCount=found.services.length;
   base.service=s?{date:s[0],ficha:s[1],action:s[3],alleged:s[5],responsible:s[2],position:s[6],workOrder:s[7]}:null;return base;
  }
 }
 if(plan?.os&&!plan.standardizedPartId&&!plan.materialCode&&!queryTokens(plan.raw).length){
  const base=analyzeStock({...effective,part:`O.S. ${plan.os}`},[],context.catalog,{...options,knownVehicle:known,sourceVersion:version});
  base.status=selected.length?"records_found":"not_found";base.resolvedPart=`O.S. ${plan.os}`;base.matchedCount=selected.length;base.evidenceCount=selected.length;base.evidence=selected.slice(0,50);base.observed=selected[0]||null;base.explanation=selected.length?`${selected.length} movimentos vinculados à O.S. Informe uma peça específica para validar sua última saída.`:"Nenhum movimento localizado para esta O.S.";return base;
 }
 const result=analyzeStock(effective,selected,context.catalog,{...options,knownVehicle:known,sourceVersion:version,reconciliationRecords:records});
 if(plan)result.warnings.unshift(...plan.interpretation);
 if(!result.matchedCount&&options.sourceMode==="sheets"){
  const tokens=queryTokens(part);const services=tokens.length?data.services.filter(s=>(!plan?.period?.from||s[0]>=plan.period.from)&&(!plan?.period?.to||s[0]<=plan.period.to)&&(!plan?.os||s[7]===plan.os)&&(!plan?.ficha||s[1]===plan.ficha)&&tokens.every(t=>normalize([s[3],s[5]].join(" ")).includes(t))).sort((a,b)=>b[0].localeCompare(a[0])||b[6]-a[6]):[];
  if(services.length){result.status="unconfirmed";result.explanation="Peça citada em serviços, sem saída documentada localizada no extrato.";result.matchedCount=services.length;result.needsReview=true;const s=services[0];result.service={date:s[0],ficha:s[1],action:s[3],alleged:s[5],responsible:s[2],position:s[6],workOrder:s[7]};}
 }
 result.ruleVersion=VALIDATION_VERSION;return result;
}

export async function executeSearchItem(item:SearchItem,context:Awaited<ReturnType<typeof createSearchContext>>,options:{sourceMode:SourceMode;recentDays:number;runId:string}){const result=await executeSearchItemInternal(item,context,options);result.request={...item};result.humanNotes=await context.getHumanNotes(result.prefix,result.resolvedPart);return result}
