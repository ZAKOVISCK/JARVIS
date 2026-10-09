import {env} from "cloudflare:workers";
import {NextRequest,NextResponse} from "next/server";
import {getRawDb} from "@/db";
import {createSearchContext,executeSearchItem} from "@/lib/search-service";
import {digest,saveSnapshots} from "@/lib/query-journal";
import type {SearchItem,SearchSnapshot,SourceMode} from "@/lib/validated-search";
import {readLimitedText,BodyLimitError} from "@/lib/request-body";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest){
 const owner=request.headers.get("oai-authenticated-user-id");if(!owner)return NextResponse.json({error:"Entre no Jarvis para consultar e salvar o histórico."},{status:401});
 try{
  const raw=await readLimitedText(request,30000);if(raw.length>30000)return NextResponse.json({error:"Lote muito grande."},{status:413});
  const body=JSON.parse(raw);const runId=body.runId;const days=Number(body.recentDays??180);const sourceMode:SourceMode=body.sourceMode;
  if(typeof runId!=="string"||!/^[-a-zA-Z0-9]{16,80}$/.test(runId)||!Array.isArray(body.items)||body.items.length<1||body.items.length>10||!Number.isInteger(days)||days<1||days>3650||!["sheets","csv"].includes(sourceMode))return NextResponse.json({error:"Parâmetros de consulta inválidos."},{status:400});
  const items:SearchItem[]=body.items.map((x:SearchItem)=>{if(!x||typeof x.key!=="string"||!/^\d{1,4}$/.test(x.key)||typeof x.prefix!=="string"||x.prefix.length>20||typeof x.part!=="string"||!x.part.trim()||x.part.length>180||(x.query!==undefined&&(typeof x.query!=="string"||x.query.length>500))||(x.kind!==undefined&&!["part","query"].includes(x.kind)))throw new TypeError("Item de consulta inválido.");return {key:x.key,prefix:x.prefix,part:x.part.trim(),query:x.query,kind:x.kind||"part"};});
  if(new Set(items.map(x=>x.key)).size!==items.length)throw new TypeError("Identificadores de consulta repetidos.");
  const db=getRawDb(),hashes=new Map<string,string>();for(const item of items)hashes.set(item.key,await digest(JSON.stringify({item,days,sourceMode})));
  const existing=(await db.prepare("SELECT item_key,request_hash,snapshot FROM query_history WHERE owner_id=? AND run_id=?").bind(owner,runId).all<{item_key:string;request_hash:string;snapshot:string}>()).results;
  for(const row of existing)if(hashes.has(row.item_key)&&hashes.get(row.item_key)!==row.request_hash)return NextResponse.json({error:"Esta consulta já foi registrada com outros parâmetros. Inicie uma nova pesquisa."},{status:409});
  const saved=new Map(existing.map(r=>[r.item_key,JSON.parse(r.snapshot) as SearchSnapshot]));const missing=items.filter(x=>!saved.has(x.key));
  if(missing.length){const context=await createSearchContext(owner,sourceMode,env.ASSETS!,db),snapshots:SearchSnapshot[]=[];for(const item of missing)snapshots.push(await executeSearchItem(item,context,{sourceMode,recentDays:days,runId}));await saveSnapshots(db,owner,hashes,snapshots);}
  // Read the authoritative row after conflict-safe insertion, including concurrent retries.
  const rows=(await db.prepare("SELECT item_key,snapshot,request_hash FROM query_history WHERE owner_id=? AND run_id=?").bind(owner,runId).all<{item_key:string;snapshot:string;request_hash:string}>()).results;
  const map=new Map(rows.map(r=>[r.item_key,r]));if(items.some(i=>map.get(i.key)?.request_hash!==hashes.get(i.key)))return NextResponse.json({error:"Conflito ao registrar a consulta. Inicie uma nova pesquisa."},{status:409});
  return NextResponse.json({records:items.map(i=>JSON.parse(map.get(i.key)!.snapshot)),saved:true},{headers:{"Cache-Control":"no-store"}});
 }catch(error){if(error instanceof BodyLimitError)return NextResponse.json({error:"Lote acima do limite."},{status:413});const invalid=error instanceof SyntaxError||error instanceof TypeError;console.error("Search failed",error);return NextResponse.json({error:invalid?"Revise os dados da pesquisa.":"Não foi possível concluir e registrar esta etapa. Seus itens foram mantidos; tente novamente."},{status:invalid?400:503});}
}
