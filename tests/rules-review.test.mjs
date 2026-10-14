import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {interpretQuery} from '../lib/query-engine.ts';
import {executeSearchItem} from '../lib/search-service.ts';
import {analyzeStock} from '../lib/validated-search.ts';
import {validateImportRow,importRowKey} from '../lib/import-pipeline.ts';
import {saveSnapshots} from '../lib/query-journal.ts';

// Entirely fictional references; never written to an operational data store.
const parent=(id,name,codes)=>({id,name,codes,aliases:[],families:['Teste'],materials:codes.length,records:0,positiveRecords:0});
const material=(code,name,standardizedPartId)=>({code,original:name,canonical:name,aliases:[],standardizedPartId,family:'Teste',familyDisplay:'Teste',kind:'componente',records:0,positiveRecords:0});
const catalog={version:1,identity:'rules-review-fictional',stats:{},standardizedParts:[parent('radiador','Radiador',['900101','900102']),parent('bico','Bico Injetor',['900103']),parent('bateria','Bateria',['900104'])],materials:[material('900101','Radiador grande','radiador'),material('900102','Radiador pequeno','radiador'),material('900103','Bico Injetor','bico'),material('900104','Bateria','bateria'),material('900105','Mangueira do Radiador',null)]};
const summary={sources:[],counts:{},fleet:[{code:'154',brand:null,model:null,plate:null,year:null,parts:0,services:0,last:''}]};
const options={knownVehicle:true,now:new Date('2026-09-28T12:00:00Z'),recentDays:180,sourceMode:'csv',sourceVersion:'fictional',runId:'TEST-RULES-REVIEW'};
const stock=(extra={})=>({id:'TEST-1',source:'TEST-EXTRATO',sourceFile:'fictional.csv',sourceLine:2,document:'TEST-DOC',prefix:'55154',part:'Radiador grande 900101',code:'900101',family:'Teste',date:'2026-09-01',time:'09:30',km:1000,quantity:1,responsible:'TEST-ACTOR',workOrder:'TEST-ORDER',movement:'issue',explicitIssue:true,note:null,...extra});
const context=records=>({summary,catalog,manifest:{version:'fictional'},getVehicle:async()=>({data:{code:'154',parts:[],services:[]},records,version:'fictional'}),getHumanNotes:async()=>[]});
const search=(query,records)=>executeSearchItem({key:'0',prefix:'55154',part:'Pergunta livre',query,kind:'query'},context(records),options);

test('consulta de acessório não é substituída pela peça-mãe que ele menciona',async()=>{
 const query='Última saída de mangueira do radiador do prefixo 55154';
 assert.equal(interpretQuery(query,summary,catalog).standardizedPartId,null);
 for(const accessory of ['mangueiras','reparo','reparos','sensores','anéis','conexões'])assert.equal(interpretQuery(`Última saída de ${accessory} do radiador do prefixo 55154`,summary,catalog).standardizedPartId,null,accessory);
 const result=await search(query,[stock(),stock({id:'TEST-HOSE',sourceLine:3,document:'TEST-HOSE-DOC',part:'Mangueira do Radiador 900105',code:'900105',date:'2026-09-02'})]);
 assert.equal(result.latest.code,'900105');assert.equal(result.matchedCount,1);
});

test('código explícito mantém o material solicitado entre códigos da mesma peça-mãe',async()=>{
 const result=await search('Última saída de Radiador código 900101 prefixo 55154',[stock(),stock({id:'TEST-OTHER',sourceLine:3,document:'TEST-OTHER-DOC',part:'Radiador pequeno 900102',code:'900102',date:'2026-09-02'})]);
 assert.equal(result.latest.code,'900101');assert.equal(result.matchedCount,1);
});

test('código explícito de quatro dígitos não é descartado nem interpretado como ano',async()=>{
 const yearCodeCatalog={...catalog,standardizedParts:[parent('radiador','Radiador',['2001'])],materials:[material('2001','Radiador','radiador')]};
 const query='Radiador código 2001 prefixo 55154';
 const plan=interpretQuery(query,summary,yearCodeCatalog);
 assert.equal(plan.materialCode,'2001');assert.equal(plan.period,null);
 const record=stock({part:'Radiador 2001',code:'2001'});
 const result=await executeSearchItem({key:'0',prefix:'55154',part:'Pergunta livre',query,kind:'query'},{...context([record]),catalog:yearCodeCatalog},options);
 assert.equal(result.latest.code,'2001');assert.equal(result.matchedCount,1);
 assert.equal(interpretQuery('Radiador em 2001 prefixo 55154',summary,yearCodeCatalog).materialCode,null);
 assert.deepEqual(interpretQuery('Radiador em 2001 prefixo 55154',summary,yearCodeCatalog).period,{from:'2001-01-01',to:'2001-12-31',label:'2001'});
});

test('código conflitante e vários códigos exigem revisão antes de ler a fonte',async()=>{
 const untouched={...context([]),getVehicle:async()=>{throw new Error('Não deveria ler a fonte com critérios conflitantes')}};
 for(const query of ['Radiador código 900103 prefixo 55154','Radiador códigos 900101 e 900102 prefixo 55154','Radiador e Bateria prefixo 55154']){
  const result=await executeSearchItem({key:'0',prefix:'55154',part:'Pergunta livre',query,kind:'query'},untouched,options);
  assert.equal(result.status,'inconclusive');assert.equal(result.latest,null);assert.equal(result.validated,false);
 }
});

test('devolução sem código explícito invalida saída vinculada da mesma peça-mãe',()=>{
 const issue=stock(),negative=stock({id:'TEST-RETURN',sourceLine:3,part:'Radiador',code:'',date:'2026-09-02',quantity:-1,movement:'return',explicitIssue:false});
 for(const part of ['Radiador','900101']){
  const result=analyzeStock({key:'0',prefix:'55154',part},[issue],catalog,{...options,reconciliationRecords:[issue,negative]});
  assert.equal(result.validated,false);assert.equal(result.latest,null);assert.ok(result.evidence.some(r=>r.id==='TEST-RETURN'));
 }
 const unrelated=analyzeStock({key:'0',prefix:'55154',part:'Radiador'},[issue],catalog,{...options,reconciliationRecords:[issue,{...negative,part:'Radiador pequeno 900102',code:'900102'}]});
 assert.equal(unrelated.validated,true);
});

const raw={rowNumber:2,sourceRecordId:'TEST-DOC',prefix:'154',part:'Peça fictícia',date:'2026-09-01',quantity:'1',movementType:'Saída',km:'82.450',mechanic:'TEST-ACTOR',workOrder:'TEST-ORDER',source:'TEST-EXTRATO',notes:''};
test('importação preserva decimais e agrupamento brasileiro sem aceitar números malformados',()=>{
 for(const [quantity,expected] of [['1.5',1.5],['1,5',1.5],['1.234,5',1234.5],['1.234',1234],['-1.5',-1.5]]){
  const result=validateImportRow({...raw,quantity});assert.equal(result.status,'accepted');assert.equal(result.candidate.quantity,expected);assert.equal(result.candidate.km,82450);
 }
 for(const quantity of ['1..5','1e2','0x10','1,2,3'])assert.equal(validateImportRow({...raw,quantity}).status,'quarantine',quantity);
 assert.equal(validateImportRow({...raw,km:'1.5'}).status,'quarantine');
});

test('deduplicação sem documento preserva movimentos com horários distintos',()=>{
 const row=validateImportRow({...raw,sourceRecordId:''}).candidate;
 assert.notEqual(importRowKey({...row,time:'09:00'}),importRowKey({...row,time:'10:00'}));
 assert.equal(importRowKey({...row,time:'09:00'}),importRowKey({...row,time:'09:00',sourceRecordId:'AUTO-OTHER'}));
 assert.equal(importRowKey(row),['55154','peca ficticia','2026-09-01',82450,1,'issue','test-actor','test-order','test-extrato',''].join('\u001f'));
});

test('regras 4 registram novo resultado e conservam integralmente snapshots das regras 3',async()=>{
 const sqlite=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 const db={prepare(sql){let values=[];return {bind(...args){values=args;return this},async run(){return sqlite.prepare(sql).run(...values)}}},async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sqlite.exec('COMMIT');return results}catch(error){sqlite.exec('ROLLBACK');throw error}}};
 try{
  const issue=stock(),item={key:'0',prefix:'55154',part:'Radiador'};
  const legacy={...analyzeStock(item,[issue],catalog,options),ruleVersion:'stock-evidence-3',runId:'TEST-RULES-LEGACY'};
  const serialized=JSON.stringify(legacy);
  await saveSnapshots(db,'TEST-OWNER',new Map([['0','TEST-HASH']]),[legacy]);
  const current=analyzeStock(item,[issue,stock({id:'TEST-RETURN',sourceLine:3,part:'Radiador',code:'',date:'2026-09-02',quantity:-1,movement:'return',explicitIssue:false})],catalog,options);
  assert.equal(current.ruleVersion,'stock-evidence-4');assert.equal(current.validated,false);
  await saveSnapshots(db,'TEST-OWNER',new Map([['0','TEST-HASH']]),[{...current,runId:legacy.runId},current]);
  const stored=sqlite.prepare('SELECT run_id,snapshot FROM query_history WHERE owner_id=? ORDER BY run_id').all('TEST-OWNER');
  assert.equal(stored.length,2);
  assert.equal(stored.find(row=>row.run_id===legacy.runId).snapshot,serialized);
  assert.equal(JSON.parse(stored.find(row=>row.run_id===current.runId).snapshot).ruleVersion,'stock-evidence-4');
 }finally{sqlite.close()}
});
