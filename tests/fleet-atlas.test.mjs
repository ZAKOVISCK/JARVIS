import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {filterFleet,groupFleet,defaultFleetFilters,comparableVehicles,recentFleetEvents,constellationPoints,vehicleProfileWarnings} from '../lib/fleet-atlas.ts';
import {resolveVehicleVisual,vehiclePhotos} from '../lib/vehicle-visuals.ts';

const summary=JSON.parse(fs.readFileSync(new URL('../public/data/summary.json',import.meta.url),'utf8'));
const index=JSON.parse(fs.readFileSync(new URL('../public/data/cognitive-index.json',import.meta.url),'utf8'));
const fleet=summary.fleet;
const query=q=>filterFleet(fleet,{...defaultFleetFilters,query:q},index);

test('Atlas mantém todos os prefixos operacionais e procura as três representações',()=>{
 assert.equal(filterFleet(fleet,defaultFleetFilters,index).length,fleet.length);
 for(const prefix of ['1','001','55001'])assert.deepEqual(query(prefix).map(v=>v.code),['1']);
 for(const prefix of ['317','55317'])assert.deepEqual(query(prefix).map(v=>v.code),['317']);
 for(const prefix of ['800','900','55560'])assert.equal(query(prefix).length,0);
 assert.deepEqual(query('DEMO-317').map(v=>v.code),['317']);
 assert.ok(query('MAN D08').length>0);
});
test('filtros combinados, datas e ordenação usam somente o cadastro fictício',()=>{
 const rows=filterFleet(fleet,{...defaultFleetFilters,brand:'VW',model:'17230OD - MAN D08',year:'2019',presence:'both',from:'2026-01-01',to:'2026-12-31',sort:'records'},index);
 assert.ok(rows.length>0);assert.ok(rows.every(v=>v.brand==='VW'&&v.model==='17230OD - MAN D08'&&v.year===2019&&v.parts>0&&v.services>0));
 assert.ok(rows.every((v,i)=>i===0||rows[i-1].parts+rows[i-1].services>=v.parts+v.services));
 assert.equal(filterFleet(fleet,{...defaultFleetFilters,from:'2026-12-31',to:'2026-01-01'},index).length,0);
 const repeated=filterFleet(fleet,{...defaultFleetFilters,repeats:true},index);
 assert.ok(repeated.every(v=>index.vehicles[v.code].repeats.length>0));
});
test('agrupamentos não perdem ou duplicam veículos e respeitam a marca',()=>{
 for(const mode of ['model','brand','year','pattern']){
  const groups=groupFleet(fleet,mode,index),codes=groups.flatMap(g=>g.rows.map(v=>v.code));
  assert.equal(codes.length,fleet.length);assert.equal(new Set(codes).size,fleet.length);
 }
 const sameModel=groupFleet(fleet,'model',index).filter(g=>g.label==='15190OD - MAN D08');
 assert.equal(sameModel.length,2); // The source contains a separate brand value; no silent correction.
 const v=fleet.find(v=>v.code==='317');assert.ok(comparableVehicles(fleet,v).every(p=>p.code!=='317'&&p.brand===v.brand&&p.model===v.model));
 assert.deepEqual(comparableVehicles(fleet,{...v,model:null}),[]);
});
test('cronologia ordena todas as linhas, preserva origem e não usa ocorrência como defeito',()=>{
 const profile={code:'1',year:2022,brand:'VW',model:'M',plate:'P'};
 const rows=recentFleetEvents({...profile,parts:[['2020-01-01','11',1000,'Antiga',1,'80',1,'Motor'],['2026-01-01','12',2000,'Recente',1,'80',8,'Motor','L12']],services:[['2025-01-01','42','80','Serviço executado','Ocorrência não usada','Defeito alegado',9,'12']]});
 assert.deepEqual(rows.map(e=>e.date),['2026-01-01','2025-01-01','2020-01-01']);
 assert.equal(rows[0].id,'EXT-0000008');assert.equal(rows[0].reference,'L12');assert.equal(rows[0].km,2000);
 assert.equal(rows[1].title,'Defeito alegado');assert.equal(rows[1].reference,'42');assert.equal(rows[1].km,null);
 assert.equal(rows[2].reference,'');assert.equal(rows[2].workOrder,'11'); // O.S. never masquerades as a launch identifier.
});
test('cadastro suspeito é sinalizado; providência não substitui defeito alegado ausente',()=>{
 const suspicious=fleet.find(v=>v.brand==='TES0T00');assert.ok(suspicious);assert.equal(vehicleProfileWarnings(suspicious).length,1);assert.equal(suspicious.brand,'TES0T00');
 assert.deepEqual(vehicleProfileWarnings(fleet.find(v=>v.brand==='VW')),[]);
 const events=recentFleetEvents({...suspicious,parts:[],services:[['2026-01-01','TEST-FICHA','TEST-ACTOR','PROVIDÊNCIA DE TESTE','OCORRÊNCIA DE TESTE','',10,'']]});assert.equal(events[0].title,'Serviço sem defeito alegado informado');
});
test('foto exata, referência de modelo e ausência são explicitamente distintas',()=>{
 const own=fleet.find(v=>v.code==='317'),photos=[{id:'TEST-PHOTO',src:'/visuals/jarvis-bus-refined.webp',prefix:'55317',brand:own.brand,model:own.model,plate:own.plate,provenance:'Teste fictício, imagem conceitual'}];assert.equal(resolveVehicleVisual(own,photos).kind,'exact');
 const other=fleet.find(v=>v.code!=='317'&&v.brand===own.brand&&v.model===own.model);assert.equal(resolveVehicleVisual(other,photos).kind,'model-reference');
 const distinct=fleet.find(v=>v.model!==own.model);assert.equal(resolveVehicleVisual(distinct,photos).kind,'unavailable');
 assert.equal(resolveVehicleVisual(null).kind,'unavailable');
 assert.equal(resolveVehicleVisual({...own,plate:'OUTRA'},photos).kind,'unavailable');
 assert.equal(vehiclePhotos.length,0);assert.ok(fs.existsSync(new URL('../public'+photos[0].src,import.meta.url)));
});
test('alvos do Atlas não se sobrepõem e permanecem dentro da área',()=>{
 for(const width of [300,380,480,560,800]){
  const count=Math.max(8,Math.min(48,Math.floor(Math.pow((Math.min(width,480)/2-42)/35,2))));
  const points=constellationPoints(count,width);assert.equal(points.length,count);
  for(const [i,p] of points.entries()){
   assert.ok(p.x>=28&&p.x<=width-28&&p.y>=24&&p.y<=456);
   for(const other of points.slice(i+1))assert.ok(Math.abs(p.x-other.x)>=56||Math.abs(p.y-other.y)>=48);
  }
 }
});
