import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {findVehicleCode,findMatches} from '../lib/fleet.ts';
import {interpretQuery,buildPartEvidence,createGuidedPartPlan,executeQueryPlan} from '../lib/query-engine.ts';
import {parseImportCsv,importRowKey,validateImportRow,normalizeOperationalPrefix,classifyMovement} from '../lib/import-pipeline.ts';

const summary=JSON.parse(fs.readFileSync(new URL('../public/data/summary.json',import.meta.url),'utf8'));
const catalog=JSON.parse(fs.readFileSync(new URL('../public/data/catalog.json',import.meta.url),'utf8'));
const vehicle=JSON.parse(fs.readFileSync(new URL('../public/data/154.json',import.meta.url),'utf8'));
const example={prefix:'55154',part:'Filtro',date:'2025-01-01',km:1000,mechanic:null,workOrder:'1001',source:'EXTRATO',notes:null,quantity:1,movementType:'issue'};

test('prefixos operacionais aceitam apenas as duas representações aprovadas',()=>{
  for(const [input,output] of [['1','55001'],['001','55001'],['55','55055'],['550','55550'],['559','55559'],['55559','55559']])assert.equal(normalizeOperationalPrefix(input),output);
  for(const input of ['0','560','800','900','55560','55154abc','1.2','-1'])assert.equal(normalizeOperationalPrefix(input),null);
});
test('datas, fichas e períodos não substituem o prefixo informado',()=>{
  assert.equal(findVehicleCode('Trocas em 12/04/2025 no prefixo 55154',summary),'154');
  assert.equal(findVehicleCode('Bicos nos últimos 6 meses do prefixo 154',summary),'154');
  assert.equal(findVehicleCode('Ficha 349.357',summary),null);
  assert.equal(findVehicleCode('Peças em 12/04/2025',summary),null);
  assert.equal(findVehicleCode('prefixo 55800 O.S. 55154',summary),null);
  assert.equal(findVehicleCode('001',summary),'1');
});
test('O.S. e ficha pesquisáveis com o mesmo formato pontuado da tela',()=>{
  const plan=interpretQuery('Peças da O.S.: 700.001 no prefixo 55154',summary,catalog);
  assert.equal(plan.os,'700001');
  assert.ok(findMatches(vehicle,plan.raw,catalog).parts.length>0);
  assert.equal(interpretQuery('Ficha 800.001 prefixo 55154',summary,catalog).ficha,'800001');
});
test('consulta guiada usa códigos das peças-mãe e mantém a ordem cronológica',()=>{
  const plan=createGuidedPartPlan('154','Bico Injetor','Motor',catalog);
  const result=executeQueryPlan(vehicle,plan,catalog,{part:'Bico Injetor',family:'Motor'});
  assert.ok(result.parts.length>0);
  assert.equal(result.parts[0].row[0],'2025-02-19');
  assert.ok(result.parts.every(e=>e.row[4]===null||e.row[4]>0));
});
test('defeito alegado não confirma instalação; ação negativa também não',()=>{
  const part=['2025-01-01','1001',1000,'BICO INJETOR '+catalog.standardizedParts.find(p=>p.name==='Bico Injetor').codes[0],1,'TEST-ACTOR',10,'Motor'];
  const service=['2025-01-01','5001','80','FEITO CONFERENCIA','','TROCAR BICO INJETOR',20,'1001'];
  const data={...vehicle,parts:[part],services:[service]};
  assert.equal(buildPartEvidence(part,data,catalog).status,'linked_service');
  for(const action of ['NÃO FOI TROCADO O BICO INJETOR','AGUARDANDO TROCA DO BICO INJETOR','NECESSARIO SUBSTITUIR BICO INJETOR','TROCAR BICO INJETOR','SUBSTITUIR BICO INJETOR']){
    data.services=[[...service.slice(0,3),action,...service.slice(4)]];
    assert.equal(buildPartEvidence(part,data,catalog).status,'linked_service');
  }
  data.services=[[...service.slice(0,3),'TROCADO BICO INJETOR',...service.slice(4)]];
  assert.equal(buildPartEvidence(part,data,catalog).status,'confirmed_replacement');
});
test('linhas de origem sobrevivem a espaços, linhas vazias e campos multilinha',()=>{
  const rows=parseImportCsv('\nPrefixo;Peça;Data;Origem;Observação\n\n154;Filtro;01/01/2025;EXTRATO;"linha um\nlinha dois"\n\n155;Óleo;01/01/2025;EXTRATO;');
  assert.deepEqual(rows.map(r=>r.rowNumber),[4,7]);
  assert.equal(rows[0].notes,'linha um\nlinha dois');
});
test('CSV sem aspas fechadas ou cabeçalho obrigatório é rejeitado',()=>{
  assert.throws(()=>parseImportCsv('Prefixo;Peça;Data;Origem\n154;"aberto;01/01/2025;EXTRATO'),/aspas/);
  assert.throws(()=>parseImportCsv('Prefixo;Peça\n154;Filtro'),/Cabeçalho/);
});
test('quantidade e natureza diferentes não são duplicidades',()=>{
  assert.notEqual(importRowKey(example),importRowKey({...example,quantity:2}));
  assert.notEqual(importRowKey(example),importRowKey({...example,movementType:'return'}));
  assert.equal(importRowKey(example),importRowKey({...example,sourceRecordId:'AUTO-ARQUIVO-L2'}));
});
test('documento repetido com quantidades diferentes permanece distinto para conferência',()=>{
  assert.notEqual(importRowKey({...example,sourceRecordId:'MOV-11'}),importRowKey({...example,sourceRecordId:'MOV-11',quantity:10}));
  assert.notEqual(importRowKey({...example,sourceRecordId:'MOV-11'}),importRowKey({...example,sourceRecordId:'MOV-12'}));
});
test('validação preserva classificação de retorno e põe datas inválidas em quarentena',()=>{
  const row={rowNumber:2,sourceRecordId:'A1',prefix:'154',part:'Filtro',date:'01/01/2025',quantity:'-2',movementType:'Devolução',km:'409.565',mechanic:'80',workOrder:'1001',source:'EXTRATO',notes:''};
  const accepted=validateImportRow(row);assert.equal(accepted.status,'accepted');
  assert.equal(accepted.candidate.km,409565);assert.equal(accepted.candidate.quantity,-2);assert.equal(accepted.candidate.movementType,'return');
  assert.equal(validateImportRow({...row,date:'31/02/2025'}).status,'quarantine');
  assert.equal(validateImportRow({...row,prefix:'800'}).status,'quarantine');
});
test('classificação explícita prevalece sobre palavras soltas na observação',()=>{
  assert.equal(classifyMovement('Saída',1,'Sem estorno'),'issue');
  assert.equal(classifyMovement('Estorno',-1),'reversal');
  assert.equal(classifyMovement('',-1),'return');
});
