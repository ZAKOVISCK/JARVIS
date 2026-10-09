import {materialCode, normalize, queryTokens, formatPrefix, type CatalogData, type VehicleData} from "./fleet.ts";
import {normalizeOperationalPrefix} from "./import-pipeline.ts";

export const VALIDATION_VERSION="stock-evidence-3";
export type ValidationStatus="validated"|"old"|"incomplete"|"unconfirmed"|"movement_only"|"not_found"|"vehicle_unknown"|"inconclusive"|"service_found"|"records_found";
export const statusLabels:Record<ValidationStatus,string>={validated:"Saída validada",old:"Saída validada · antiga",incomplete:"Saída validada · dados incompletos",unconfirmed:"Sem confirmação de saída",movement_only:"Movimento sem saída validada",not_found:"Sem registros",vehicle_unknown:"Veículo sem dados suficientes",inconclusive:"Requer análise",service_found:"Serviço localizado",records_found:"Registros da O.S."};
export type SourceMode="sheets"|"csv";
export type SearchItem={key:string;prefix:string;part:string;query?:string;kind?:"part"|"query"};
export type StockRecord={id:string;source:string;sourceFile:string;sourceLine:number|null;document:string|null;prefix:string;part:string;family:string;code:string;date:string;time:string|null;km:number|null;quantity:number|null;responsible:string|null;workOrder:string|null;movement:string;explicitIssue:boolean;note:string|null};
export type HumanNote={id:string;queryId:string;kind:string;actor:string;createdAt:string;note:string};
export type SearchSnapshot={
 queryDomain?:'parts'|'services'|'mixed';
 humanNotes?:HumanNote[];
 request?:SearchItem;id:string;runId:string;itemKey:string;queriedAt:string;query:string;prefix:string;part:string;resolvedPart:string;sourceMode:SourceMode;sourceVersion:string;ruleVersion:string;recentDays:number;status:ValidationStatus;validated:boolean;isOld:boolean;incomplete:boolean;needsReview:boolean;ageDays:number|null;latest:StockRecord|null;observed:StockRecord|null;evidence:StockRecord[];evidenceCount:number;matchedCount:number;excludedCount:number;explanation:string;warnings:string[];checks:{label:string;passed:boolean}[];assessments?:{recordId:string;eligible:boolean;reasons:string[]}[];service?:{date:string;ficha:string;action:string;alleged:string;responsible:string|null;position:number;workOrder:string}|null};
export function dayInBrazil(now=new Date()){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);}
export function validDate(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+"T12:00:00Z");return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===value;}
export function validTime(value:string|null){return !!value&&/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);}
export function parseBatch(text:string):{items:SearchItem[];errors:string[];duplicates:number}{
 const items:SearchItem[]=[],errors:string[]=[];const seen=new Set<string>();let duplicates=0;
 text.split(/\r?\n/).forEach((line,i)=>{if(!line.trim())return;const match=line.trim().match(/^(?:prefixo\s*)?(\d{1,5})\s*(?:→|->|:|\t|;|\s+-\s+)\s*(.+)$/i);
  if(!match){errors.push(`Linha ${i+1}: use Prefixo → Peça, Peça.`);return;}
  const prefix=normalizeOperationalPrefix(match[1]);if(!prefix){errors.push(`Linha ${i+1}: prefixo fora de 001–559.`);return;}
  const parts=match[2].split(/[,;\t|]+/).map(x=>x.trim()).filter(Boolean);if(!parts.length){errors.push(`Linha ${i+1}: informe uma peça.`);return;}
  for(const part of parts){if(part.length>180){errors.push(`Linha ${i+1}: descrição acima de 180 caracteres.`);continue;}const key=prefix+"|"+normalize(part);if(seen.has(key)){duplicates++;continue;}seen.add(key);items.push({key:String(items.length),prefix,part});}
 });if(items.length>500)errors.push("Divida a lista em lotes de até 500 combinações.");return {items,errors,duplicates};
}
export function sheetRecords(data:VehicleData,sourceFile="EXTRATO GERAL.xlsx"):StockRecord[]{return data.parts.map(r=>({id:`EXT-${String(r[6]).padStart(7,"0")}`,source:"EXTRATO GERAL",sourceFile,sourceLine:r[6],document:r[8]||null,prefix:formatPrefix(data.code),part:r[3],family:r[7],code:materialCode(r[3]),date:r[0],time:r[9]||null,km:r[2],quantity:r[4],responsible:r[5],workOrder:r[1]||null,movement:r[4]===null?"unknown":r[4]>0?"issue":r[4]<0?"return":"adjustment",explicitIssue:Boolean(r[8])&&r[4]!==null&&r[4]>0,note:null}));}
export function resolvePart(label:string,catalog:CatalogData){
 const folded=normalize(label).replace(/[^a-z0-9]+/g," ").trim();
 const exact=catalog.standardizedParts.filter(p=>[p.name,...p.aliases].some(a=>normalize(a).replace(/[^a-z0-9]+/g," ").trim()===folded));
 if(exact.length===1)return {name:exact[0].name,codes:new Set(exact[0].codes),ambiguous:false};
 if(exact.length>1)return {name:label,codes:null,ambiguous:true};
 const codes=catalog.materials.filter(p=>p.code===label.trim()||normalize(`${p.canonical} ${p.code}`)===normalize(label)||normalize(p.original).trim()===normalize(label).trim()||normalize(p.canonical).trim()===normalize(label).trim());
 if(codes.length)return {name:codes.length===1?codes[0].canonical:label,codes:new Set(codes.map(x=>x.code)),ambiguous:false};
 return {name:label,codes:null,ambiguous:false};
}
export function analyzeStock(item:SearchItem,records:StockRecord[],catalog:CatalogData,options:{knownVehicle:boolean;now?:Date;recentDays:number;sourceMode:SourceMode;sourceVersion:string;runId:string;reconciliationRecords?:StockRecord[]}):SearchSnapshot{
 const now=options.now||new Date(),today=dayInBrazil(now),resolved=resolvePart(item.part,catalog),tokens=queryTokens(item.part);
 const result:SearchSnapshot={id:crypto.randomUUID(),runId:options.runId,itemKey:item.key,queriedAt:now.toISOString(),query:item.query||`${item.prefix} → ${item.part}`,prefix:normalizeOperationalPrefix(item.prefix)||item.prefix,part:item.part,resolvedPart:resolved.name,sourceMode:options.sourceMode,sourceVersion:options.sourceVersion,ruleVersion:VALIDATION_VERSION,recentDays:options.recentDays,status:"not_found",validated:false,isOld:false,incomplete:false,needsReview:false,ageDays:null,latest:null,observed:null,evidence:[],evidenceCount:0,matchedCount:0,excludedCount:0,explanation:"Nenhum registro correspondente à peça nesta fonte.",warnings:[],checks:[]};
 if(!options.knownVehicle){result.status="vehicle_unknown";result.explanation="Prefixo sem cadastro ou sem dados na fonte selecionada.";return result;}
 if(resolved.ambiguous||(!resolved.codes&&!tokens.length&&!/^\d{4,6}$/.test(item.part))){result.status="inconclusive";result.needsReview=true;result.explanation="Peça não identificada com precisão. Informe o nome completo ou código do material.";return result;}
 const definition=new Map(catalog.materials.map(p=>[p.code,p]));
 const match=(r:StockRecord)=>{if(r.prefix!==result.prefix)return false;if(resolved.codes){if(r.code)return resolved.codes.has(r.code);const candidate=resolvePart(r.part,catalog);return !!candidate.codes&&!candidate.ambiguous&&candidate.name===resolved.name;}if(/^\d{4,6}$/.test(item.part))return r.code===item.part;const m=definition.get(r.code);const words=normalize([r.part,m?.canonical,...(m?.aliases||[])].join(" "));return tokens.length>0&&tokens.every(t=>new RegExp(`\\b${t}\\w*`).test(words));};
 const matched=records.filter(match).sort((a,b)=>b.date.localeCompare(a.date)||(validTime(b.time)?b.time!:'').localeCompare(validTime(a.time)?a.time!:'')||a.id.localeCompare(b.id));
 result.matchedCount=matched.length;result.observed=matched[0]||null;
 if(!matched.length)return result;
 // A broad free-text match spanning unrelated components cannot silently choose one.
 if(!resolved.codes&&new Set(matched.map(r=>definition.get(r.code)?.standardizedPartId||r.code||normalize(r.part))).size>1){result.status="inconclusive";result.needsReview=true;result.explanation="A descrição corresponde a materiais diferentes. Selecione uma peça-mãe ou informe o código.";result.evidence=matched.slice(0,8);result.evidenceCount=matched.length;return result;}
 const candidates:StockRecord[]=[];const excluded:StockRecord[]=[];const relatedOutside:StockRecord[]=[];const assessments:{recordId:string;eligible:boolean;reasons:string[]}[]=[];
 const negatives=(options.reconciliationRecords||matched).filter(match).filter(n=>n.movement==="reversal"||n.movement==="return"||(n.quantity!==null&&n.quantity<0));
 const byDocument=new Map<string,StockRecord[]>(),byOrder=new Map<string,StockRecord[]>(),matchedIds=new Set(matched.map(r=>r.id)),outsideIds=new Set<string>();
 const negativeKey=(r:StockRecord,reference:string)=>JSON.stringify([r.source,r.code,reference]);
 for(const n of negatives){for(const [index,reference] of [[byDocument,n.document],[byOrder,n.workOrder]] as const){if(!reference)continue;const key=negativeKey(n,reference),group=index.get(key)||[];group.push(n);index.set(key,group)}}
 for(const r of matched){
  const reliable=r.explicitIssue&&r.movement==="issue"&&r.quantity!==null&&Number.isFinite(r.quantity)&&r.quantity>0&&!!r.document?.trim()&&!!r.sourceFile.trim()&&Number.isSafeInteger(r.sourceLine)&&r.sourceLine!>0&&validDate(r.date)&&r.date<=today;
  const blocked=/\b(reserv\w*|solicit\w*|requisic\w*|cadastro|pendente|nao entregue|nao retirad\w*)\b/.test(normalize(r.note||""));
  // Without a line-level reversal link, any negative on the same document or O.S.
  // is treated conservatively as requiring reconciliation. Missing O.S. does not join.
  const relatedNegatives=[...new Map([...(r.document?byDocument.get(negativeKey(r,r.document))||[]:[]),...(r.workOrder?byOrder.get(negativeKey(r,r.workOrder))||[]:[])].filter(n=>n.id!==r.id&&n.date>=r.date).map(n=>[n.id,n])).values()];
  const negative=relatedNegatives.length>0;
  const reasons:string[]=[];
  if(!r.explicitIssue||r.movement!=="issue")reasons.push("Natureza de saída não confirmada");
  if(r.quantity===null||!Number.isFinite(r.quantity)||r.quantity<=0)reasons.push("Quantidade ausente, inválida, nula ou negativa");
  if(!r.document?.trim())reasons.push("Documento do lançamento ausente");
  if(!r.sourceFile.trim()||!Number.isSafeInteger(r.sourceLine)||r.sourceLine!<=0)reasons.push("Arquivo ou linha de origem ausente ou inválido");
  if(!validDate(r.date)||r.date>today)reasons.push("Data inválida ou futura");
  if(blocked)reasons.push("Indicação de reserva, solicitação ou pendência");
  if(negative)reasons.push("Movimento negativo, devolução ou estorno relacionado ao documento ou O.S.; exige conferência");
  assessments.push({recordId:r.id,eligible:reliable&&!blocked&&!negative,reasons});
  if(reliable&&!blocked&&!negative)candidates.push(r);else excluded.push(r);
  for(const n of relatedNegatives)if(!matchedIds.has(n.id)&&!outsideIds.has(n.id)){relatedOutside.push(n);outsideIds.add(n.id)}
 }
 result.excludedCount=excluded.length;result.evidence=[...candidates.slice(0,4),...excluded.slice(0,4)];result.evidenceCount=matched.length+relatedOutside.length;
 if(relatedOutside.length){result.evidence.push(...relatedOutside.slice(0,4));result.warnings.push(`${relatedOutside.length} movimento(s) vinculado(s) fora do período selecionado foram considerados na conciliação.`);for(const r of relatedOutside)assessments.push({recordId:r.id,eligible:false,reasons:["Movimento vinculado fora do período pesquisado; impede confirmação sem conciliação"]});}
 result.assessments=assessments.filter(a=>result.evidence.some(e=>e.id===a.recordId));
 const latest=candidates[0];
 if(!latest){result.status=matched.every(r=>r.movement!=="issue"&&r.movement!=="unknown")?"movement_only":"unconfirmed";result.needsReview=true;result.explanation="SEM SAÍDA VALIDADA LOCALIZADA. Os registros não atendem aos critérios de comprovação, ou possuem devolução/estorno relacionado.";result.checks=[{label:"Saída positiva explicitamente identificada",passed:matched.some(r=>r.explicitIssue&&r.quantity!==null&&r.quantity>0)},{label:"Documento e linha de origem disponíveis",passed:matched.some(r=>!!r.document&&!!r.sourceLine)},{label:"Lançamento elegível após conferência de movimentos",passed:false}];return result;}
 result.validated=true;result.latest=latest;result.ageDays=Math.max(0,Math.floor((Date.parse(today+"T12:00:00Z")-Date.parse(latest.date+"T12:00:00Z"))/86400000));result.isOld=result.ageDays>options.recentDays;
 result.incomplete=latest.km===null||!latest.responsible||!latest.workOrder;
 const sameDay=candidates.filter(r=>r.date===latest.date);if(sameDay.length>1&&(sameDay.some(r=>!validTime(r.time))||sameDay.filter(r=>r.time?.slice(0,5)===latest.time?.slice(0,5)&&(r.time?.length===5||latest.time?.length===5||r.time===latest.time)).length>1)){result.needsReview=true;result.status="inconclusive";result.explanation="Há saídas documentadas na data mais recente, mas o horário não permite determinar qual foi a última.";result.warnings.push(`${sameDay.length} lançamentos elegíveis no mesmo dia. A posição na planilha não comprova a ordem de saída.`);result.latest=null;result.validated=false;result.isOld=false;result.incomplete=false;result.evidence=sameDay.slice(0,8);result.evidenceCount=matched.length;result.assessments=assessments.filter(a=>result.evidence.some(e=>e.id===a.recordId));return result;}
 if(latest.time&&!validTime(latest.time)){result.latest={...latest,time:null};result.incomplete=true;result.needsReview=true;result.warnings.push(`Horário inválido na origem (${latest.time}). Mantido nas evidências, sem utilizá-lo como hora confirmada.`)}
 if(latest.km!==null&&(!Number.isSafeInteger(latest.km)||latest.km<0)){result.latest={...result.latest!,km:null};result.incomplete=true;result.needsReview=true;result.warnings.push('Quilometragem inválida na origem. O valor permanece nas evidências e não foi usado como KM confirmado.')}
 result.status=result.isOld?"old":result.incomplete?"incomplete":"validated";
 result.explanation=`Última saída documentada elegível na fonte selecionada${excluded.length?`; ${excluded.length} registro(s) sem comprovação ou com movimento relacionado foram desconsiderados`:""}.`;
 result.checks=[{label:"Saída com quantidade positiva",passed:true},{label:"Documento do lançamento e linha de origem",passed:true},{label:"Data válida e prefixo correspondente",passed:true},{label:"Sem devolução/estorno relacionado identificado",passed:true}];
 if(!latest.time)result.warnings.push("Horário de saída não informado na fonte.");if(result.incomplete)result.warnings.push("Há campos complementares ausentes; nenhum valor foi inferido.");if(result.isOld)result.warnings.push(`Saída anterior ao limite de ${options.recentDays} dias definido nesta consulta.`);result.warnings.push("Saída do estoque não comprova instalação no veículo.");return result;
}
