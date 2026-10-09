import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {interpretQuery,withVehicleContext} from '../lib/query-engine.ts';
import {analyzeStock,validTime} from '../lib/validated-search.ts';
import {executeSearchItem} from '../lib/search-service.ts';
import {snapshotChanges} from '../lib/cognitive.ts';
import {VehicleResource} from '../lib/vehicle-resource.ts';
import {csvCell,csvDocument} from '../lib/export-data.ts';
import {findDuplicateKeys} from '../lib/import-deduplication.ts';
import {validateImportRow,importRowKey} from '../lib/import-pipeline.ts';

const summary=JSON.parse(fs.readFileSync(new URL('../public/data/summary.json',import.meta.url),'utf8'));
const catalog=JSON.parse(fs.readFileSync(new URL('../public/data/catalog.json',import.meta.url),'utf8'));
const parent=catalog.standardizedParts.find(p=>p.name==='Bico Injetor');
// Explicit test fixtures. Never inserted into a deployed database.
const stock=(extra={})=>({id:'TEST-1',source:'EXTRATO GERAL',sourceFile:'fixture.csv',sourceLine:2,document:'TEST-DOC-1',prefix:'55154',part:'BICO INJETOR '+parent.codes[0],code:parent.codes[0],family:'Motor',date:'2026-09-01',time:'09:30',km:82450,quantity:1,responsible:'TEST-ACTOR',workOrder:'TEST-ORDER',movement:'issue',explicitIssue:true,note:null,...extra});
const item={key:'0',prefix:'55154',part:'Bico Injetor'};
const options={knownVehicle:true,now:new Date('2026-09-28T12:00:00Z'),recentDays:180,sourceMode:'sheets',sourceVersion:'fixture-v1',runId:'TEST-OPERATIONS-01'};
const analyze=(rows)=>analyzeStock(item,rows,catalog,options);
const profile=code=>({code,brand:null,model:null,plate:null,year:null,services:[],parts:[]});

test('períodos relativos respeitam o calendário brasileiro e o último dia de cada mês',()=>{
 assert.deepEqual(interpretQuery('Bico no último 1 mês prefixo 55154',summary,catalog,new Date('2026-03-31T14:00:00Z')).period,{from:'2026-02-28',to:'2026-03-31',label:'Último 1 mês'});
 assert.equal(interpretQuery('Bico no último 1 ano prefixo 55154',summary,catalog,new Date('2024-02-29T14:00:00Z')).period.from,'2023-02-28');
 const nearMidnight=interpretQuery('Bico nos últimos 7 dias prefixo 55154',summary,catalog,new Date('2026-10-09T01:00:00Z'));
 assert.equal(nearMidnight.period.to,'2026-10-08');assert.equal(nearMidnight.period.from,'2026-10-01');
});
test('datas inválidas, intervalos invertidos, datas em excesso e período zero exigem revisão',()=>{
 for(const text of ['31/02/2026','2026-02-30','30/09/2026 a 01/09/2026','01/01/2026, 01/02/2026, 01/03/2026','nos últimos 0 dias'])assert.ok(interpretQuery('Bico prefixo 55154 '+text,summary,catalog).issues.length,text);
 assert.equal(interpretQuery('Bico prefixo 55154 de 2026-01-01 a 2026-09-30',summary,catalog).issues.length,0);
});
test('contexto do veículo preenche ausência de prefixo e respeita prefixo explícito ou inválido',()=>{
 assert.equal(withVehicleContext('Última saída de biturbo','55154',summary,catalog),'Última saída de biturbo do prefixo 55154');
 for(const query of ['Bico prefixo 55001','Bico prefixo 55800','Bico prefixos 001, 002'])assert.equal(withVehicleContext(query,'55154',summary,catalog),query);
 assert.ok(withVehicleContext('Código 55154','55001',summary,catalog).endsWith('prefixo 55001'));
 assert.ok(interpretQuery('Bico dos prefixos 001, 002',summary,catalog).issues.length);
 assert.ok(interpretQuery('Bico 55154 e 55125',summary,catalog).issues.length);
 assert.equal(interpretQuery('Bico prefixos 001, 55001',summary,catalog).issues.length,0);
});
test('pergunta inválida não lê a fonte nem substitui ausência por valor inferido',async()=>{
 const context={summary,catalog,manifest:{version:'fixture'},getVehicle:async()=>{throw new Error('A fonte não deveria ser lida')},getHumanNotes:async()=>[]};
 for(const query of ['Bico prefixo 55800','Bico prefixo 55154 de 31/02/2026','Bico prefixos 55154, 55125']){
  const result=await executeSearchItem({...item,kind:'query',query},context,options);
  assert.equal(result.status,'inconclusive');assert.equal(result.validated,false);assert.equal(result.latest,null);
 }
});
test('pergunta usa contexto; prefixo explícito prevalece e serviço auxiliar respeita o período',async()=>{
 const read=[];const data={...profile('154'),services:[['2025-01-01','TEST-FICHA','TEST-ACTOR','FEITO REPARO ESPECIAL','','DEFEITO ESPECIAL',8,'TEST-ORDER']]};
 const context={summary,catalog,manifest:{version:'fixture'},getVehicle:async prefix=>{read.push(prefix);return {data,records:[],version:'fixture'}},getHumanNotes:async()=>[]};
 const result=await executeSearchItem({...item,kind:'query',query:'Peça especial do prefixo 55001 de 01/09/2026 a 30/09/2026'},context,options);
 assert.equal(result.prefix,'55001');assert.deepEqual(read,['55001']);assert.equal(result.service??null,null);assert.equal(result.status,'not_found');
 read.length=0;const service=await executeSearchItem({...item,kind:'query',query:'Serviços especiais'},context,options);
 assert.deepEqual(read,['55154']);assert.equal(service.queryDomain,'services');assert.equal(service.latest,null);
});
test('solicitar serviços de peça-mãe preserva o domínio; CSV não é apresentado como ficha ou serviço',async()=>{
 for(const query of ['Serviços de Bico Injetor prefixo 55154','Manutenção de Bico Injetor prefixo 55154'])assert.equal(interpretQuery(query,summary,catalog).domain,'services');
 assert.equal(interpretQuery('Peças e serviços de Bico Injetor prefixo 55154',summary,catalog).domain,'mixed');
 const context={summary,catalog,manifest:{version:'fixture'},getVehicle:async()=>({data:profile('154'),records:[stock()],version:'fixture'}),getHumanNotes:async()=>[]};
 const r=await executeSearchItem({...item,kind:'query',query:'Serviços de Bico Injetor'},context,{...options,sourceMode:'csv'});assert.equal(r.status,'inconclusive');assert.equal(r.validated,false);assert.equal(r.latest,null);assert.equal(r.queryDomain,'services');
});
test('precisões de horário distintas na mesma hora e minuto não definem a última saída',()=>{
 const rows=[stock({time:'09:30'}),stock({id:'TEST-2',document:'TEST-DOC-2',time:'09:30:45'})];
 assert.equal(analyze(rows).status,'inconclusive');assert.equal(analyze(rows).latest,null);
 const ordered=analyze([rows[0],stock({id:'TEST-3',document:'TEST-DOC-3',time:'09:31:00'})]);assert.equal(ordered.latest.id,'TEST-3');
});
test('horário e KM inválidos ficam na evidência, sem aparecer como valores confirmados',()=>{
 for(const time of ['25:00','09:80','12:20:99'])assert.equal(validTime(time),false);
 assert.equal(validTime('23:59:59'),true);
 const original=stock({time:'25:00',km:-1}),result=analyze([original]);
 assert.equal(result.validated,true);assert.equal(result.status,'incomplete');assert.equal(result.latest.time,null);assert.equal(result.latest.km,null);
 assert.equal(result.evidence[0].time,'25:00');assert.equal(result.evidence[0].km,-1);assert.equal(original.time,'25:00');
 assert.equal(analyze([stock({time:'25:00'}),stock({id:'TEST-2',document:'TEST-DOC-2'})]).status,'inconclusive');
});
test('quantidade, documento e posição inválidos não validam uma saída',()=>{
 for(const extra of [{quantity:Infinity},{quantity:NaN},{document:' '},{sourceFile:' '},{sourceLine:-1},{sourceLine:1.5}])assert.equal(analyze([stock(extra)]).validated,false,JSON.stringify(extra));
});
test('comparação detecta quantidade, horário, responsável e critérios mesmo com ID e status iguais',()=>{
 const before=analyze([stock()]),after={...before,latest:{...before.latest,quantity:2,time:'10:30',responsible:'OTHER'},recentDays:30};
 const changes=snapshotChanges(before,after);for(const field of ['Quantidade','Horário','Responsável','Antiguidade após (dias)'])assert.ok(changes.some(c=>c.field===field));
 assert.equal(snapshotChanges(before,structuredClone(before)).length,0);
});
test('CSV neutraliza fórmulas mesmo depois de caracteres invisíveis e preserva valores numéricos',()=>{
 for(const text of ['=SUM(A1)',' \t+CMD','\u0000@SUM(A1)','\r\n-1+2','\uFEFF=2'])assert.ok(csvCell(text).startsWith('"\''),JSON.stringify(text));
 assert.equal(csvCell(-2),'"-2"');assert.equal(csvCell('uma "peça"'),'"uma ""peça"""');assert.equal(csvCell(null),'""');
 assert.equal(csvDocument([['Peça','Quantidade'],['Bico',2]]),'\uFEFF"Peça";"Quantidade"\r\n"Bico";"2"');
});
test('leitura compartilhada não duplica a rede e desmontar um painel não interrompe o outro',async()=>{
 let resolve,calls=0,signal;const resource=new VehicleResource((url,init)=>{calls++;signal=init.signal;return new Promise(r=>resolve=r)});
 const a=resource.acquire('001'),b=resource.acquire('1');assert.equal(calls,1);assert.equal(a.promise,b.promise);a.release();assert.equal(signal.aborted,false);
 resolve(new Response(JSON.stringify(profile('1'))));assert.equal((await b.promise).code,'1');b.release();
 const cached=resource.acquire('1');await cached.promise;cached.release();assert.equal(calls,1);
});
test('cancelar todos os leitores libera a requisição e uma nova tentativa pode recuperar a fonte',async()=>{
 let calls=0;const resource=new VehicleResource((url,init)=>{calls++;if(calls>1)return Promise.resolve(new Response(JSON.stringify(profile('1'))));return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('Cancelado','AbortError'))))});
 const first=resource.acquire('1'),rejection=assert.rejects(first.promise,{name:'AbortError'});first.release();await rejection;
 const retry=resource.acquire('1');assert.equal((await retry.promise).code,'1');retry.release();assert.equal(calls,2);
});
test('cache é limitado e uma fonte de outro veículo não entra no cache',async()=>{
 const calls=[],resource=new VehicleResource(async url=>{const code=url.match(/(\d+)\.json/)[1];calls.push(code);return new Response(JSON.stringify(profile(code)))},2);
 for(const code of ['1','2','1','3','2']){const read=resource.acquire(code);await read.promise;read.release()}
 assert.deepEqual(calls,['1','2','3','2']);assert.throws(()=>resource.acquire('800'));assert.throws(()=>new VehicleResource(fetch,0));
 let invalid=true;const wrong=new VehicleResource(async()=>new Response(JSON.stringify(profile(invalid?'2':'1'))));
 const read=wrong.acquire('1');await assert.rejects(read.promise,/não corresponde/);read.release();invalid=false;const recovered=wrong.acquire('1');assert.equal((await recovered.promise).code,'1');recovered.release();
});
test('campos além dos limites entram em quarentena sem truncar seus conteúdos',()=>{
 const row={rowNumber:2,prefix:'154',part:'Bico',date:'01/09/2026',source:'EXTRATO',sourceRecordId:'TEST-DOC',quantity:'1',movementType:'Saída',km:'82450',mechanic:'TEST-ACTOR',workOrder:'TEST-ORDER',notes:''};
 for(const extra of [{part:'P'.repeat(181)},{source:'S'.repeat(181)},{notes:'N'.repeat(501)},{workOrder:'W'.repeat(61)},{rowNumber:-1}])assert.equal(validateImportRow({...row,...extra}).status,'quarantine');
 assert.equal(validateImportRow(row).status,'accepted');
});
test('conciliação encontra duplicidade legada após a primeira página e não lê outro proprietário',async()=>{
 const sqlite=new DatabaseSync(':memory:');for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 const candidate={prefix:'55154',part:'TEST-PEÇA',date:'2026-09-01',km:82450,mechanic:'TEST-ACTOR',workOrder:'TEST-ORDER',source:'EXTRATO',notes:null,quantity:1,movementType:'issue',movementEvidence:'explicit',sourceRecordId:'TEST-LAST',sourceLine:1002};
 const insert=sqlite.prepare('INSERT INTO maintenance(owner_id,prefix,part,date,km,mechanic,work_order,source,notes,record_key,source_record_id,quantity,movement_type) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)');
 for(let i=0;i<1001;i++)insert.run('OWNER',candidate.prefix,i===1000?candidate.part:'OTHER-'+i,candidate.date,candidate.km,candidate.mechanic,candidate.workOrder,candidate.source,null,'legacy-'+i,i===1000?candidate.sourceRecordId:'TEST-'+i,1,'issue');
 insert.run('OTHER-OWNER',candidate.prefix,'OTHER-OWNER-PEÇA',candidate.date,candidate.km,candidate.mechanic,candidate.workOrder,candidate.source,null,'another','OTHER-DOC',1,'issue');
 const pages=[];const db={prepare(sql){let args=[];return {bind(...values){args=values;return this},async all(){const rows=sqlite.prepare(sql).all(...args);pages.push(rows.length);assert.equal(args[0],'OWNER');return {results:rows}}}}};
 const keys=await findDuplicateKeys(db,'OWNER',[candidate]);assert.ok(keys.has(importRowKey(candidate)));assert.deepEqual(pages,[1000,1]);
 assert.equal((await findDuplicateKeys(db,'OWNER',[])).size,0);sqlite.close();
});
