import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// Hand-authored development scenarios. Never reads a spreadsheet or production data.
const directory = fileURLToPath(new URL('../public/data/', import.meta.url));
const existing = existsSync(directory) ? readdirSync(directory) : [];
if (existing.length) {
  const marker = new URL('../public/data/summary.json', import.meta.url);
  if (!existsSync(marker) || JSON.parse(readFileSync(marker, 'utf8')).datasetMode !== 'synthetic') {
    throw new Error('Não é seguro gerar exemplos sobre uma base existente. Use uma cópia de desenvolvimento vazia.');
  }
  console.log('Base fictícia existente preservada. Nenhum registro foi substituído.');
  process.exit(0);
}
mkdirSync(directory, {recursive: true});
const definitions = JSON.parse(readFileSync(new URL('../tests/fixtures/standardized-parts.json', import.meta.url), 'utf8'));
const generatedAt = '2026-09-01T12:00:00.000Z';
const digest = value => createHash('sha256').update(value).digest('hex');
const write = (name, value) => {
  const raw = JSON.stringify(value);
  writeFileSync(new URL('../public/data/' + name, import.meta.url), raw + '\n');
  return digest(raw + '\n');
};
const profiles = [
  {code:'1', year:2022, brand:'VW', model:'15190OD - MAN D08', plate:'DEMO001'},
  {code:'2', year:2024, brand:'BYD', model:'MODELO ELÉTRICO DE TESTE', plate:'DEMO002'},
  {code:'125', year:2019, brand:'VW', model:'17230OD - MAN D08', plate:'DEMO125'},
  {code:'154', year:2019, brand:'VW', model:'17230OD - MAN D08', plate:'DEMO154'},
  {code:'317', year:2019, brand:'VW', model:'17230OD - MAN D08', plate:'DEMO317'},
  {code:'318', year:2019, brand:'VW', model:'17230OD - MAN D08', plate:'DEMO318'},
  // Deliberately inconsistent brand for testing warnings. Not an actual vehicle.
  {code:'559', year:2022, brand:'TES0T00', model:'15190OD - MAN D08', plate:'DEMO559'},
];
const codeFor = index => String(900001 + index);
const vehicles = profiles.map(profile => {
  const parts = definitions.map((part, i) => [
    profile.code === '154' && i === 0 ? '2025-02-19' : '2026-08-' + String(i + 1).padStart(2, '0'),
    String(700001 + i), 82000 + i * 100, part.name.toUpperCase() + ' ' + codeFor(i),
    1, 'DEMO-ALMOX', Number(profile.code) * 100 + i + 2,
    part.families[0], 'DEMO-' + profile.code + '-' + String(i + 1).padStart(3,'0'),
  ]);
  parts.push(['2024-01-01','700100',60000,'BICO INJETOR ' + codeFor(0),1,'DEMO-ALMOX',Number(profile.code)*100+90,'Motor','DEMO-OLD-'+profile.code]);
  const services = [['2026-08-24','800001','DEMO-MEC','FEITO CONFERENCIA','OCORRÊNCIA FICTÍCIA','VERIFICAÇÃO DE TESTE',Number(profile.code)*100+92,'700001']];
  return {...profile, datasetMode:'synthetic', services, parts};
});
const allParts = vehicles.flatMap(vehicle => vehicle.parts);
const materials = definitions.map((part,i) => ({
  code:codeFor(i), original:part.name.toUpperCase()+' '+codeFor(i), canonical:part.name,
  family:part.families[0], familyDisplay:part.families[0],
  kind:/^(oleo|filtro)-/.test(part.id)?'consumivel':'componente',
  aliases:part.aliases, standardizedPartId:part.id,
  records:allParts.filter(row => row[3].endsWith(codeFor(i))).length,
  positiveRecords:allParts.filter(row => row[3].endsWith(codeFor(i)) && row[4]>0).length,
}));
const standardizedParts = definitions.map((part,i) => ({...part,codes:[codeFor(i)],materials:1,records:materials[i].records,positiveRecords:materials[i].positiveRecords}));
const catalog = {datasetMode:'synthetic',version:2,identity:'family+canonical+code',stats:{
  families:new Set(materials.map(part=>part.family)).size, materials:materials.length,
  materialsWithPositiveMovement:materials.length,aliases:definitions.reduce((n,p)=>n+p.aliases.length,0),
  movements:allParts.length, standardizedFamilies:4,standardizedParts:definitions.length,standardizedMaterials:materials.length,
},standardizedParts,materials};
const summary = {datasetMode:'synthetic',datasetLabel:'EXEMPLOS FICTÍCIOS — DESENVOLVIMENTO',
  sources:['SERVIÇOS FICTÍCIOS','EXTRATO FICTÍCIO','FROTA FICTÍCIA'],
  counts:{s:vehicles.reduce((n,v)=>n+v.services.length,0),p:allParts.length,positive_p:allParts.length,negative_p:0,without_os_p:0,parts_with_service_os:vehicles.length},
  fleet:vehicles.map(({services,parts,...profile})=>({...profile,last:'2026-08-24',services:services.length,parts:parts.length})),
};
const vehicleHashes=Object.fromEntries(vehicles.map(vehicle=>[vehicle.code,write(vehicle.code+'.json',vehicle)]));
write('catalog.json',catalog);
write('summary.json',summary);
write('source-manifest.json',{datasetMode:'synthetic',version:digest(JSON.stringify(vehicleHashes)),file:'EXTRATO FICTÍCIO — NÃO OPERACIONAL',sourceSha256:digest('hand-authored-development-fixtures-v1'),contract:'stock-extract-with-document',documentColumn:'NUMREG',timeAvailable:false,records:allParts.length,withDocument:allParts.length,vehicleHashes});
write('admin-audit.json',{datasetMode:'synthetic',generatedAt,vehicles:vehicles.length,parts:allParts.length,services:summary.counts.s,
  invalidPrefixes:0,invalidDates:0,futureDates:0,missingPartDescriptions:0,emptyServiceRows:0,negativeStockMovements:0,
  movements:{issues:allParts.length,returns:0,reversals:0,adjustments:0},probablePartDuplicateGroups:0,probablePartDuplicateExcess:0,
  probableDuplicateSamples:[],probableServiceDuplicateGroups:0,probableServiceDuplicateExcess:0,duplicateCatalogCodes:0,duplicateStandardizedIds:0,countMismatches:[],status:'approved',
  classificationMethod:'Somente dados fictícios para desenvolvimento. Não representa auditoria da frota operacional.'});
await import('./build-cognitive-index.mjs');
console.log(`Gerados ${vehicles.length} veículos fictícios e ${allParts.length} movimentos fictícios. Nenhum dado real foi utilizado.`);
