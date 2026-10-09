import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {drizzle} from 'drizzle-orm/d1';
import {inspectImportCsv,parseImportCsv,validateImportRow} from '../lib/import-pipeline.ts';
import {readLimitedText,BodyLimitError} from '../lib/request-body.ts';
import {INSERT_SNAPSHOT,snapshotValues} from '../lib/query-journal.ts';
const {build}=createRequire(import.meta.resolve('wrangler'))('esbuild'),root=path.resolve(import.meta.dirname,'..'),work=path.join(root,'work/api-tests');fs.mkdirSync(work,{recursive:true});
const raw=new DatabaseSync(':memory:');for(const name of fs.readdirSync(path.join(root,'drizzle')).filter(n=>n.endsWith('.sql')).sort())raw.exec(fs.readFileSync(path.join(root,'drizzle',name),'utf8'));
const db={prepare(sql){let args=[];return {bind(...v){args=v;return this},async all(){return {results:raw.prepare(sql).all(...args),success:true}},async raw(){const s=raw.prepare(sql);s.setReturnArrays(true);return s.all(...args)},async first(){return raw.prepare(sql).get(...args)||null},async run(){return {success:true,results:[],meta:{changes:Number(raw.prepare(sql).run(...args).changes)}}}}},async batch(statements){raw.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.all());raw.exec('COMMIT');return results}catch(e){raw.exec('ROLLBACK');throw e}}};
// Isolated dependency injection only. Never bypasses the browser or deployed authentication.
globalThis.__jarvisTest={db,orm:drizzle(db),env:{DB:db,ASSETS:{async fetch(req){return new Response(fs.readFileSync(path.join(root,'public',new URL(req.url).pathname)))}}}};
const routes={};for(const name of ['maintenance','imports','imports/[id]','search','query-history','query-history/[id]/events','query-history/[id]/compare']){const out=path.join(work,name.replaceAll('/','-')+'.mjs');await build({entryPoints:[path.join(root,'app/api',name,'route.ts')],bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'silent',plugins:[{name:'test-adapters',setup(b){b.onResolve({filter:/^(@\/db$|cloudflare:workers$|next\/server$)/},a=>({path:a.path,namespace:'harness'}));b.onLoad({filter:/.*/,namespace:'harness'},a=>({contents:a.path==='@/db'?'export const getDb=()=>globalThis.__jarvisTest.orm;export const getRawDb=()=>globalThis.__jarvisTest.db':a.path==='cloudflare:workers'?'export const env=globalThis.__jarvisTest.env':'export const NextResponse=Response;export const NextRequest=Request;'}))}}]});routes[name]=await import(out)}
function request(body,owner='A',url='http://test.local/api',method=body===undefined?'GET':'POST'){const r=new Request(url,{method,headers:owner?{'oai-authenticated-user-id':owner,'Content-Type':'application/json'}:{},...(body===undefined?{}:{body:JSON.stringify(body)})});r.nextUrl=new URL(r.url);return r}
const params=id=>({params:Promise.resolve({id})});
const csv='NUMREG;Prefixo;Peça;Data;Origem;Quantidade;Natureza;KM;OS;Responsável;Hora\nD1;154;Bico Injetor;01/09/2026;EXTRATO;1;Saída;82.450;349357;80051;08:30\nD1;154;Filtro de Ar;01/09/2026;EXTRATO;1;Saída;82.450;349357;80051;08:30\nD1;154;Bico Injetor;01/09/2026;EXTRATO;1;Saída;82.450;349357;80051;08:30\nD2;800;Filtro de Ar;01/09/2026;EXTRATO;1;Saída;82.450;349357;80051;08:30\nD3;154;Bico Injetor;02/09/2026;EXTRATO;-1;Devolução;82.450;900;80051;08:30\nD4;154;Filtro de Ar;02/09/2026;EXTRATO;-1;Estorno;82.450;901;80051;08:30\nD5;154;Filtro de Ar;03/09/2026;EXTRATO;-1;;82.450;902;80051;08:30';
test('mapeamento, natureza explícita e limites de corpo são validados',async()=>{const i=inspectImportCsv(csv);assert.equal(i.count,7);assert.equal(i.mapping.sourceRecordId,0);assert.throws(()=>parseImportCsv(csv,{...i.mapping,prefix:0}),/dois campos/);assert.equal(validateImportRow(parseImportCsv(csv)[4]).candidate.movementEvidence,'explicit');await assert.rejects(readLimitedText(new Request('http://test',{method:'POST',body:'ação'}),5),BodyLimitError)});
test('todas as rotas negam ausência de identidade',async()=>{for(const [name,m]of Object.entries(routes))for(const method of ['GET','POST'])if(m[method])assert.equal((await m[method](request(method==='POST'?{}:undefined,'','http://test',method),params('missing'))).status,401,name)});
test('importação, busca, correção, comparação e reversão preservam evidências e isolam proprietários',async()=>{
 const staged=await routes.imports.POST(request({fileName:'audit.csv',content:csv}));assert.equal(staged.status,201);const {job}=await staged.json();assert.equal(job.acceptedRows,5);assert.equal(job.duplicateRows,1);assert.equal(job.quarantineRows,1);assert.equal(job.fileHash.length,64);
 const m=routes['imports/[id]'];const preview=await(await m.GET(request(),params(job.id))).json();assert.equal(preview.rows.length,7);assert.equal(preview.rows[0].payload.sourceRecordId,'D1');assert.equal(preview.report.movements.return,1);assert.equal(preview.report.movements.reversal,1);assert.equal(preview.report.movements.unknown,1);assert.equal(raw.prepare('SELECT COUNT(*) n FROM maintenance').get().n,0);assert.equal((await m.GET(request(undefined,'B'),params(job.id))).status,404);
 assert.equal((await m.POST(request({action:'integrate'}),params(job.id))).status,200);assert.equal((await m.POST(request({action:'integrate'}),params(job.id))).status,409);assert.equal(raw.prepare('SELECT COUNT(*) n FROM maintenance').get().n,5);
 const body={runId:'TEST-COGNITIVE-0001',sourceMode:'csv',recentDays:180,items:[{key:'0',prefix:'55154',part:'Bico Injetor'}]};const sr=await routes.search.POST(request(body));assert.equal(sr.status,200);const q=(await sr.json()).records[0];assert.equal(q.latest.document,'D1');assert.equal(q.latest.km,82450);assert.equal((await(await routes.search.POST(request(body))).json()).records[0].id,q.id);assert.equal((await routes.search.POST(request({...body,recentDays:30}))).status,409);assert.equal((await(await routes.search.POST(request(body,'B'))).json()).records[0].latest,null);
 const saved=raw.prepare('SELECT snapshot FROM query_history WHERE id=?').get(q.id).snapshot;const event=routes['query-history/[id]/events'];assert.equal((await event.POST(request({kind:'correction',note:'Conferir instalação na oficina.'},'B'),params(q.id))).status,404);assert.equal((await event.POST(request({kind:'correction',note:'Conferir instalação na oficina.'}),params(q.id))).status,201);
 const comparison=routes['query-history/[id]/compare'];const changed=await(await comparison.POST(request({}),params(q.id))).json();assert.notEqual(changed.after.id,q.id);assert.equal(changed.after.humanNotes.length,1);assert.equal(raw.prepare('SELECT snapshot FROM query_history WHERE id=?').get(q.id).snapshot,saved);
 const filtered=await(await routes['query-history'].GET(request(undefined,'A','http://test?decision=correction'))).json();assert.equal(filtered.records[0].id,q.id);
 const count=raw.prepare('SELECT COUNT(*) n FROM query_history').get().n;assert.equal((await m.POST(request({action:'rollback'}),params(job.id))).status,200);assert.equal(raw.prepare('SELECT COUNT(*) n FROM maintenance').get().n,0);assert.equal(raw.prepare('SELECT COUNT(*) n FROM query_history').get().n,count);const after=await(await comparison.POST(request({}),params(q.id))).json();assert.equal(after.after.status,'not_found');assert.equal(after.before.latest.document,'D1');assert.ok(after.changes.some(c=>c.field==='Lançamento'));
});
test('cancelamento não publica; formatos e cabeçalhos inválidos são rejeitados',async()=>{const {job}=await(await routes.imports.POST(request({fileName:'cancel.csv',content:csv}))).json();assert.equal((await routes['imports/[id]'].POST(request({action:'cancel'}),params(job.id))).status,200);assert.equal((await routes['imports/[id]'].POST(request({action:'integrate'}),params(job.id))).status,409);assert.equal((await routes.imports.POST(request({fileName:'x.xlsx',content:csv}))).status,400);assert.equal((await routes.imports.POST(request({fileName:'x.csv',content:'coluna\n1'}))).status,400)});
test('API lê contratos fictícios sem depender de dados operacionais',async()=>{const r=await routes.search.POST(request({runId:'TEST-COGNITIVE-DEMO',sourceMode:'sheets',recentDays:180,items:[{key:'0',prefix:'55154',part:'Bico Injetor'},{key:'1',prefix:'55125',part:'Bi turbo/Turbina'}]}));assert.equal(r.status,200);const data=await r.json();assert.equal(data.records.length,2);assert.ok(data.records.every(r=>r.sourceVersion&&r.request));const summary=JSON.parse(fs.readFileSync(path.join(root,'public/data/summary.json'),'utf8'));assert.equal(summary.datasetMode,'synthetic');assert.equal(summary.fleet.length,7);assert.equal(summary.counts.p+summary.counts.s,182);assert.ok(data.records.every(r=>r.latest===null||r.latest.document.startsWith('DEMO-')))});

test('histórico completo usa corte estável, não repete páginas nem inclui consultas inseridas depois',async()=>{
 const template=JSON.parse(raw.prepare('SELECT snapshot FROM query_history LIMIT 1').get().snapshot),owner='EXPORT-OWNER',runId='TEST-EXPORT-ALL',createdAt='2026-09-28T08:00:00.000Z';
 const insert=(id,itemKey,queriedAt=createdAt)=>{const snapshot={...template,id,runId,itemKey,queriedAt};raw.prepare(INSERT_SNAPSHOT).run(...snapshotValues(owner,'fixture',snapshot));return snapshot};
 for(let i=0;i<65;i++)insert('TEST-HISTORY-'+String(i).padStart(4,'0'),String(i));
 const first=await(await routes['query-history'].GET(request(undefined,owner,'http://test?run='+runId))).json();
 assert.equal(first.total,65);assert.equal(first.records.length,30);assert.ok(first.nextCursor);assert.ok(Number.isSafeInteger(first.watermark));
 // This result was created earlier but committed later; the rowid watermark must exclude it.
 insert('TEST-HISTORY-LATE','100','2026-09-27T08:00:00.000Z');
 const ids=first.records.map(r=>r.id);let page=first;
 while(page.nextCursor){const p=new URLSearchParams({run:runId,watermark:String(first.watermark),asOf:first.asOf,cursor:page.nextCursor});page=await(await routes['query-history'].GET(request(undefined,owner,'http://test?'+p))).json();assert.equal(page.total,65);ids.push(...page.records.map(r=>r.id))}
 assert.equal(ids.length,65);assert.equal(new Set(ids).size,65);assert.ok(!ids.includes('TEST-HISTORY-LATE'));
 assert.equal((await(await routes['query-history'].GET(request(undefined,'OTHER-OWNER','http://test?run='+runId))).json()).total,0);
 for(const query of ['cursor=invalid','watermark=1','watermark=-1&asOf='+first.asOf,'from=2026-02-31','from=2026-09-30&to=2026-09-01'])assert.equal((await routes['query-history'].GET(request(undefined,owner,'http://test?'+query))).status,400,query);
 const latest=await(await routes['query-history'].GET(request(undefined,owner,'http://test?run='+runId))).json();assert.equal(latest.total,66);
});
test('histórico localiza ficha e posição legadas com formato pontuado, sem reescrever snapshots',async()=>{
 const template=JSON.parse(raw.prepare('SELECT snapshot FROM query_history LIMIT 1').get().snapshot),snapshot={...template,id:'TEST-LEGACY-FICHA',runId:'TEST-LEGACY-SEARCH',itemKey:'0',queriedAt:'2026-09-28T08:30:00.000Z',status:'service_found',latest:null,service:{date:'2026-09-01',ficha:'349357',action:'TEST-ACTION',alleged:'TEST-DEFECT',responsible:'TEST-ACTOR',position:145768,workOrder:''}};
 raw.prepare(INSERT_SNAPSHOT).run(...snapshotValues('LEGACY-SEARCH-OWNER','fixture',snapshot));const original=JSON.stringify(snapshot);
 for(const q of ['349.357','145768']){const response=await routes['query-history'].GET(request(undefined,'LEGACY-SEARCH-OWNER','http://test?q='+encodeURIComponent(q)));assert.equal(response.status,200);assert.equal((await response.json()).records[0].id,snapshot.id)}
 assert.equal(raw.prepare('SELECT snapshot FROM query_history WHERE id=?').get(snapshot.id).snapshot,original);
});
test('duas preparações concorrentes se conciliam ao publicar e legado não gera outra saída',async()=>{
 const owner='IMPORT-RACE-OWNER',content=csv.split('\n').slice(0,2).join('\n');
 const prepare=async()=>{const response=await routes.imports.POST(request({fileName:'race.csv',content},owner));assert.equal(response.status,201);return (await response.json()).job};
 const a=await prepare(),b=await prepare();assert.equal(a.acceptedRows,1);assert.equal(b.acceptedRows,1);
 const m=routes['imports/[id]'];assert.equal((await m.POST(request({action:'integrate'},owner),params(a.id))).status,200);
 assert.equal((await m.POST(request({action:'integrate'},owner),params(b.id))).status,200);
 const second=(await(await m.GET(request(undefined,owner),params(b.id))).json());assert.equal(second.job.acceptedRows,0);assert.equal(second.job.duplicateRows,1);assert.equal(second.rows[0].status,'duplicate');
 assert.equal(raw.prepare('SELECT COUNT(*) n FROM maintenance WHERE owner_id=?').get(owner).n,1);
 // Simulate a historical key without changing its documentary fields.
 raw.prepare('UPDATE maintenance SET record_key=? WHERE owner_id=?').run('LEGACY-KEY',owner);
 const legacy=await prepare();assert.equal(legacy.acceptedRows,0);assert.equal(legacy.duplicateRows,1);
 const unauth=await routes.maintenance.POST(request({},owner));assert.equal(unauth.status,410);
 assert.equal((await routes.maintenance.GET(request(undefined,owner))).headers.get('Cache-Control'),'no-store');
});
test('campos excessivos e mapeamentos inválidos não publicam linhas e quarentena conserva a descrição',async()=>{
 const before=raw.prepare('SELECT COUNT(*) n FROM maintenance').get().n;
 const content='Prefixo;Peça;Data;Origem\n154;'+('P'.repeat(181))+';01/09/2026;EXTRATO';
 const response=await routes.imports.POST(request({fileName:'long.csv',content},'LONG-OWNER'));assert.equal(response.status,201);const {job}=await response.json();assert.equal(job.quarantineRows,1);assert.equal(job.acceptedRows,0);
 const preview=await(await routes['imports/[id]'].GET(request(undefined,'LONG-OWNER'),params(job.id))).json();assert.equal(preview.rows[0].payload.part.length,181);assert.match(preview.rows[0].reason,/não foi truncado/);
 assert.equal((await routes.imports.POST(request({fileName:'map.csv',content:csv,mapping:{prefix:0,part:0,date:3,source:4}}))).status,400);
 assert.equal(raw.prepare('SELECT COUNT(*) n FROM maintenance').get().n,before);
});
test('rastreabilidade rejeita nome truncável e posições fornecidas inválidas ou repetidas',async()=>{
 const before=raw.prepare('SELECT COUNT(*) n FROM import_jobs').get().n,row=parseImportCsv(csv)[0];
 for(const rowNumber of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1,'145768',null]){
  const response=await routes.imports.POST(request({fileName:'position.csv',rows:[{...row,rowNumber}]},'POSITION-OWNER'));assert.equal(response.status,400,String(rowNumber));assert.match((await response.json()).error,/posição na planilha inválida/);
 }
 assert.equal((await routes.imports.POST(request({fileName:'duplicate-position.csv',rows:[row,{...row,part:'Filtro de Ar'}]},'POSITION-OWNER'))).status,400);
 assert.equal((await routes.imports.POST(request({fileName:'N'.repeat(177)+'.csv',content:csv},'POSITION-OWNER'))).status,400);
 assert.equal(raw.prepare('SELECT COUNT(*) n FROM import_jobs').get().n,before);
});
