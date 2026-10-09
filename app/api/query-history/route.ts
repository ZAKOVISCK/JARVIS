import {NextRequest,NextResponse} from 'next/server';
import {getRawDb} from '@/db';
import {normalize} from '@/lib/fleet';
import {normalizeOperationalPrefix} from '@/lib/import-pipeline';
import {statusLabels,validDate} from '@/lib/validated-search';
export const dynamic='force-dynamic';

function readCursor(value:string){
 if(value.length>400)throw new TypeError();
 try{
  const cursor=JSON.parse(atob(value));
  if(typeof cursor.date!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(cursor.date)||Number.isNaN(Date.parse(cursor.date))||typeof cursor.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(cursor.id))throw new TypeError();
  return cursor as {date:string;id:string};
 }catch{throw new TypeError()}
}

export async function GET(request:NextRequest){
 const owner=request.headers.get('oai-authenticated-user-id');
 if(!owner)return NextResponse.json({error:'Entre no Jarvis para acessar seu histórico de consultas.'},{status:401});
 try{
  const p=request.nextUrl.searchParams,db=getRawDb(),clauses=['owner_id=?'],args:(string|number)[]=[owner];
  // Freeze committed records and the decision cutoff for multi-page exports.
  const suppliedWatermark=p.get('watermark'),suppliedAsOf=p.get('asOf');
  if(Boolean(suppliedWatermark)!==Boolean(suppliedAsOf))throw new TypeError();
  const watermark=suppliedWatermark!==null?Number(suppliedWatermark):Number((await db.prepare('SELECT COALESCE(MAX(rowid),0) AS n FROM query_history WHERE owner_id=?').bind(owner).first<{n:number}>())?.n||0);
  const asOf=suppliedAsOf||new Date().toISOString();
  if(!Number.isSafeInteger(watermark)||watermark<0||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(asOf)||Number.isNaN(Date.parse(asOf)))throw new TypeError();
  clauses.push('rowid<=?','created_at<=?');args.push(watermark,asOf);
  for(const [key,value] of [['id',p.get('id')],['run_id',p.get('run')]] as const){
   if(value){if(value.length>80)throw new TypeError();clauses.push(key+'=?');args.push(value)}
  }
  const q=p.get('q')?.trim();
  if(q){
   const normalized=normalize(q.slice(0,180)),compact=/^\d[\d.\s]*$/.test(normalized)?normalized.replace(/[.\s]/g,''):normalized;
   const like='%'+compact.replace(/[\\%_]/g,'\\$&')+'%';
   const fields=["search_text","CAST(json_extract(snapshot,'$.latest.id') AS TEXT)","CAST(json_extract(snapshot,'$.latest.document') AS TEXT)","CAST(json_extract(snapshot,'$.latest.sourceLine') AS TEXT)","CAST(json_extract(snapshot,'$.service.ficha') AS TEXT)","CAST(json_extract(snapshot,'$.service.position') AS TEXT)"];
   clauses.push('('+fields.map(field=>"LOWER(COALESCE("+field+",'')) LIKE ? ESCAPE '\\'").join(' OR ')+')');
   args.push(...fields.map(()=>like));
  }
  if(p.get('prefix')){const prefix=normalizeOperationalPrefix(p.get('prefix')!);if(!prefix)throw new TypeError();clauses.push('prefix=?');args.push(prefix)}
  const source=p.get('source');
  if(source&&source!=='all'){if(!['sheets','csv'].includes(source))throw new TypeError();clauses.push('source_mode=?');args.push(source)}
  const decision=p.get('decision');
  if(decision&&decision!=='all'){
   if(!['confirm','correction','report'].includes(decision))throw new TypeError();
   clauses.push('EXISTS(SELECT 1 FROM audit_events e WHERE e.owner_id=query_history.owner_id AND e.subject_id=query_history.id AND e.kind=? AND e.created_at<=?)');args.push(decision,asOf);
  }
  const status=p.get('status');
  if(status&&status!=='all'){
   if(status==='confirmed')clauses.push("json_extract(snapshot,'$.validated')=1");
   else if(status==='unconfirmed_all')clauses.push("json_extract(snapshot,'$.validated')=0");
   else if(status==='incomplete')clauses.push("json_extract(snapshot,'$.incomplete')=1");
   else if(status==='old')clauses.push("json_extract(snapshot,'$.isOld')=1");
   else if(Object.hasOwn(statusLabels,status)){clauses.push('status=?');args.push(status)}
   else throw new TypeError();
  }
  for(const [key,op,suffix] of [['from','>=','T00:00:00-03:00'],['to','<=','T23:59:59.999-03:00']]){
   const d=p.get(key);if(d){if(!validDate(d))throw new TypeError();clauses.push('created_at '+op+' ?');args.push(new Date(d+suffix).toISOString())}
  }
  if(p.get('from')&&p.get('to')&&p.get('from')!>p.get('to')!)throw new TypeError();
  const page=Math.max(1,Math.min(100000,Number(p.get('page'))||1));if(!Number.isInteger(page))throw new TypeError();
  const where=clauses.join(' AND '),cursor=p.get('cursor'),pageArgs=[...args];let pageWhere=where;
  if(cursor){
   if(!suppliedWatermark||!suppliedAsOf)throw new TypeError();
   const last=readCursor(cursor);pageWhere+=' AND (created_at<? OR (created_at=? AND id<?))';pageArgs.push(last.date,last.date,last.id);
  }
  const responses=await db.batch<Record<string,unknown>>([
   db.prepare('SELECT snapshot,created_at,id FROM query_history WHERE '+pageWhere+' ORDER BY created_at DESC,id DESC LIMIT 31 OFFSET ?').bind(...pageArgs,cursor?0:(page-1)*30),
   db.prepare('SELECT status,COUNT(*) AS n FROM query_history WHERE '+where+' GROUP BY status').bind(...args),
  ]);
  const counts=Object.fromEntries(responses[1].results.map(r=>[String(r.status),Number(r.n)])),rows=responses[0].results.slice(0,30),last=rows.at(-1);
  const nextCursor=responses[0].results.length>30&&last?btoa(JSON.stringify({date:last.created_at,id:last.id})):null;
  return NextResponse.json({records:rows.map(r=>JSON.parse(String(r.snapshot))),total:Object.values(counts).reduce((a,b)=>a+b,0),counts,page,watermark,asOf,nextCursor},{headers:{'Cache-Control':'no-store'}});
 }catch(e){
  if(!(e instanceof TypeError))console.error('Query history failed',e);
  return NextResponse.json({error:e instanceof TypeError?'Revise o prefixo, o período e a paginação dos filtros.':'Não foi possível carregar o histórico. Tente novamente.'},{status:e instanceof TypeError?400:503});
 }
}
