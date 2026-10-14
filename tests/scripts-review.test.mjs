import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

function fixture(t,script){
 const root=mkdtempSync(join(tmpdir(),'jarvis-script-review-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 mkdirSync(join(root,'scripts'));mkdirSync(join(root,'public','data'),{recursive:true});
 copyFileSync(new URL('../scripts/'+script,import.meta.url),join(root,'scripts',script));
 const write=(name,data)=>writeFileSync(join(root,'public','data',name),JSON.stringify(data));
 return {root,write,read:name=>JSON.parse(readFileSync(join(root,'public','data',name),'utf8')),
  run:()=>spawnSync(process.execPath,[join(root,'scripts',script)],{cwd:root,encoding:'utf8'})};
}

test('catálogo aceita fonte parcial e acentuada sem transformar quantidade ausente em movimento positivo',t=>{
 const f=fixture(t,'build-part-catalog.mjs');
 f.write('1.json',{code:'1',services:[],parts:[
  ['2026-01-01','1',null,'Câmbio 900011',null,'DEMO',2,'Câmbio e Embreagem'],
  ['2026-01-02','2',null,'Câmbio 900011',1,'DEMO',3,'Câmbio e Embreagem'],
  ['2026-01-03','3',null,'Bomba de Óleo 900005',null,'DEMO',4,'Motor'],
 ]});
 const result=f.run();assert.equal(result.status,0,result.stderr);
 const catalog=f.read('catalog.json');
 assert.equal(catalog.materials.find(m=>m.code==='900011').positiveRecords,1);
 assert.equal(catalog.materials.find(m=>m.code==='900005').positiveRecords,0);
 assert.equal(catalog.materials.find(m=>m.code==='900011').standardizedPartId,'cambio');
 assert.equal(catalog.materials.find(m=>m.code==='900005').standardizedPartId,'bomba-oleo');
 assert.equal(catalog.standardizedParts.find(p=>p.id==='radiador').records,0);
 assert.deepEqual(catalog.standardizedParts.find(p=>p.id==='radiador').codes,[]);
});

test('auditoria rejeita datas impossíveis e não conta quantidade desconhecida como saída provável',t=>{
 const f=fixture(t,'audit-phase-10.mjs');
 f.write('summary.json',{fleet:[{code:'1'}],counts:{p:2,s:1}});
 f.write('catalog.json',{materials:[],standardizedParts:[]});
 f.write('1.json',{code:'1',parts:[
  ['2026-02-30','1',null,'Filtro 900012',null,'DEMO',2,'Filtros'],
  ['2026-02-28','2',null,'Filtro 900012',1,'DEMO',3,'Filtros'],
 ],services:[['2026-02-30','1','DEMO','CONFERÊNCIA FICTÍCIA','','',4,'1']]});
 const result=f.run();assert.equal(result.status,1,result.stderr);
 const audit=f.read('admin-audit.json');
 assert.equal(audit.status,'rejected');assert.equal(audit.invalidDates,2);
 assert.equal(audit.movements.issues,1);assert.equal(audit.parts,2);
});
