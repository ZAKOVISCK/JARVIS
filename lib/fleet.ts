export type ServiceRow = [date:string, ficha:string, mec:string|null, action:string, occurrence:string, alleged:string, sourceRow:number, os:string];
export type PartRow = [date:string, os:string, km:number|null, material:string, quantity:number|null, stockEmployee:string|null, sourceRow:number, family:string, document?:string|null, time?:string|null];
export type VehicleProfile = { code:string; year:number|string|null; brand:string|null; model:string|null; plate:string|null };
export type VehicleData = VehicleProfile & { services:ServiceRow[]; parts:PartRow[] };
export type FleetItem = VehicleProfile & { last:string; services:number; parts:number };
export type Summary = { sources:string[]; counts:Record<string,number>; fleet:FleetItem[]; datasetMode?:'synthetic'; datasetLabel?:string };
export type CatalogKind = "componente"|"consumivel"|"acessorio"|"servico";
export type CatalogMaterial = { code:string; original:string; canonical:string; family:string; familyDisplay:string; kind:CatalogKind; aliases:string[]; standardizedPartId:string|null; records:number; positiveRecords:number };
export type StandardizedPart = { id:string;name:string;families:string[];aliases:string[];codes:string[];materials:number;records:number;positiveRecords:number };
export type CatalogData = { version:number; identity:string; stats:{families:number;materials:number;materialsWithPositiveMovement:number;aliases:number;movements:number;standardizedFamilies:number;standardizedParts:number;standardizedMaterials:number};standardizedParts:StandardizedPart[];materials:CatalogMaterial[] };
export type PartCatalogItem = { name:string; records:number; canonical?:string;code?:string;kind?:CatalogKind;aliases?:string[];standardizedPartId?:string;codes?:string[] };
export type PartCatalogFamily = PartCatalogItem & { parts:PartCatalogItem[] };

export function normalize(value:string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
}

export function formatPrefix(value:string) {
  const digits=value.replace(/\D/g,"");
  if (digits.startsWith("55")&&digits.length===5) return digits;
  return digits.length<=3?`55${digits.padStart(3,"0")}`:digits;
}

export function formatRecordNumber(value:string) {
  if (!value) return "Não informado";
  const numeric=Number(value);
  return Number.isFinite(numeric)?numeric.toLocaleString("pt-BR"):value;
}

const ignored = new Set("quando qual quais quem onde ultima ultimo ultimas ultimos foi foram quero saber mostrar mostre diga para pela pelo todas todos todo toda peca pecas material materiais codigo cod servico servicos defeito defeitos ocorrencia ocorrencias providencia providencias historico relacao troca trocou trocada trocado substituir substituicao manutencao manutencoes realizado realizada executado executada saida saidas retirada retiradas registrada registrado registro registros veiculo onibus carro prefixo ficha familia data periodo hoje ontem dia dias mes meses ano anos entre ate desde km quilometragem mecanico responsavel ordem os do da dos das no na nos nas de em por com uma um o a e ao aos".split(" "));

export function queryTokens(query:string) {
  return normalize(query).replace(/\b\d+\b/g," ").split(/[^a-z]+/).filter(word => word.length > 2 && !ignored.has(word));
}

export function materialCode(material:string) {
  return material.match(/(?:^|\s)(\d{4,6})$/)?.[1]||"";
}

export function findCatalogMaterial(catalog:CatalogData|null|undefined, material:string) {
  const code=materialCode(material);
  return code?catalog?.materials.find(item=>item.code===code):undefined;
}

export function findVehicleCode(query:string, summary:Summary):string|null {
  const codes = new Set(summary.fleet.filter(item=>Number(item.code)>=1&&Number(item.code)<=559).map(item=>String(Number(item.code))));
  const resolve=(value:string)=>{
    const code=/^55\d{3}$/.test(value)?String(Number(value.slice(2))):/^\d{1,3}$/.test(value)?String(Number(value)):"";
    return codes.has(code)?code:null;
  };
  const normalized=normalize(query);
  const explicit=normalized.match(/\b(?:prefixo|carro|veiculo|onibus)\s*(?:n[º°.]?\s*)?[:#-]?\s*(\d{1,5})\b/);
  if(explicit)return resolve(explicit[1]);
  const remainder=normalized
    .replace(/\b\d{2}\/\d{2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g," ")
    .replace(/\b(?:o\.?s\.?|ordem\s+de\s+servico|ficha|codigo|cod|material)\s*[nº°.:#-]*\s*\d[\d.]*/g," ")
    .replace(/\b\d+\s+(?:dias?|meses?|anos?|km)\b/g," ");
  for(const match of remainder.matchAll(/\b\d{1,5}\b/g)){
    const code=resolve(match[0]);if(code)return code;
  }
  return null;
}

/** Accept the same grouping separators used in the visible O.S. and ficha labels. */
export function normalizeReferenceNumbers(query:string) {
  return query.replace(/\b((?:o\.?s\.?|ordem\s+de\s+servi[cç]o|ficha)\s*[nº°.:#-]*\s*)(\d{1,3}(?:\.\d{3})+)\b/gi,(_,label:string,digits:string)=>label+digits.replaceAll(".",""));
}

export function findMatches(data:VehicleData, query:string, catalog?:CatalogData|null) {
  query=normalizeReferenceNumbers(query);
  const tokens = queryTokens(query);
  const os = query.match(/\b(?:o\.?s\.?|ordem\s+de\s+servi[cç]o)\s*[nº°:#-]*\s*(\d{4,8})\b/i)?.[1];
  const ficha = query.match(/\bficha\s*[nº°:#-]*\s*(\d{3,8})\b/i)?.[1];
  const vehicleNumbers=new Set([data.code,formatPrefix(data.code)]);
  const requestedCodes=[...query.matchAll(/\b\d{4,6}\b/g)].map(match=>match[0]).filter(value=>!vehicleNumbers.has(value)&&value!==os&&value!==ficha&&!/^(?:19|20)\d{2}$/.test(value));
  const definitions=new Map((catalog?.materials||[]).map(item=>[item.code,item]));
  const normalizedQuery=normalize(query);
  const accessoryWords=/\b(?:abracadeira|anel|arruela|bucha|cano|conector|conexao|flexivel|junta|mangueira|parafuso|porca|prisioneiro|retentor|sensor|suporte|tampao|terminal|trava|tubo|valvula)\b/;
  const standardizedCandidates=(catalog?.standardizedParts||[]).filter(item=>[item.name,...item.aliases].some(label=>{
    const labelTokens=queryTokens(label);return labelTokens.length>0&&labelTokens.every(token=>tokens.includes(token));
  }));
  const standardizedIntent=!requestedCodes.length&&standardizedCandidates.length===1&&(!accessoryWords.test(normalizedQuery)||standardizedCandidates[0].id==="valvula-termostatica")?new Set(standardizedCandidates[0].codes):null;
  const turboIntent=!accessoryWords.test(normalizedQuery)&&/\b(?:bi[ -]?turbo|biturbo|turbo|turbina)\b/.test(normalizedQuery);
  const parts = data.parts.filter(row => {
    if((row[4]!==null&&row[4]<=0)||(os&&row[1]!==os))return false;
    const definition=definitions.get(materialCode(row[3]));
    if(standardizedIntent&&!standardizedIntent.has(materialCode(row[3])))return false;
    if(turboIntent&&!definition?.aliases.some(alias=>["turbina","turbo","biturbo","bi turbo"].includes(normalize(alias))))return false;
    const searchable=normalize([row[3],definition?.canonical||"",definition?.code||"",...(definition?.aliases||[])].join(" "));
    return tokens.every(token=>searchable.includes(token))&&requestedCodes.every(code=>definition?.code===code||searchable.includes(code));
  });
  const services = data.services.filter(row => (!os || row[7] === os) && (!ficha || row[1]===ficha) && (!tokens.length || tokens.every(t=>normalize([row[3],row[4],row[5]].join(" ")).includes(t))));
  return {parts,services};
}

export function mechanicsForOrder(data:VehicleData, os:string):string[] {
  if (!os) return [];
  return [...new Set(data.services.filter(row=>row[7]===os && row[2]).map(row=>row[2] as string))];
}

export function buildPartCatalog(rows:PartRow[], catalog?:CatalogData|null):PartCatalogFamily[] {
  const definitions=new Map((catalog?.materials||[]).map(item=>[item.code,item]));
  const families=new Map<string,{name:string;records:number;parts:Map<string,PartCatalogItem>}>();
  for(const row of rows){
    if(row[4]!==null&&row[4]<=0)continue;
    const part=row[3]?.trim(); if(!part)continue;
    const family=row[7]?.trim()||"Sem família informada";
    const familyKey=normalize(family),partKey=normalize(part);
    const current=families.get(familyKey)||{name:family,records:0,parts:new Map<string,PartCatalogItem>()};
    current.records++;
    const definition=definitions.get(materialCode(part));
    const currentPart=current.parts.get(partKey)||{name:part,records:0,canonical:definition?.canonical,code:definition?.code,kind:definition?.kind,aliases:definition?.aliases};
    currentPart.records++;
    current.parts.set(partKey,currentPart);
    families.set(familyKey,current);
  }
  return [...families.values()].map(family=>({
    name:family.name,
    records:family.records,
    parts:[...family.parts.values()].sort((a,b)=>a.name.localeCompare(b.name,"pt-BR")),
  })).sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));
}

export function buildStandardizedPartCatalog(rows:PartRow[], catalog?:CatalogData|null):PartCatalogFamily[] {
  if(!catalog)return [];
  const positiveCodes=new Map<string,number>();
  for(const row of rows){
    if(row[4]!==null&&row[4]<=0)continue;
    const code=materialCode(row[3]);
    if(code)positiveCodes.set(code,(positiveCodes.get(code)||0)+1);
  }
  const families=new Map<string,PartCatalogFamily>();
  for(const definition of catalog.standardizedParts||[]){
    const records=definition.codes.reduce((total,code)=>total+(positiveCodes.get(code)||0),0);
    if(!records)continue;
    const part:PartCatalogItem={name:definition.name,canonical:definition.name,records,kind:definition.id.startsWith("oleo-")||definition.id.startsWith("filtro-")?"consumivel":"componente",aliases:definition.aliases,standardizedPartId:definition.id,codes:definition.codes};
    for(const familyName of definition.families){
      const family=families.get(familyName)||{name:familyName,records:0,parts:[]};
      family.records+=records;family.parts.push(part);families.set(familyName,family);
    }
  }
  return [...families.values()].map(family=>({...family,parts:family.parts.sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"))})).sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));
}

export function findExactPartRows(data:VehicleData, part:string, family?:string, catalog?:CatalogData|null):PartRow[] {
  const partKey=normalize(part),familyKey=family?normalize(family):"";
  const code=materialCode(part);
  const standardized=(catalog?.standardizedParts||[]).find(item=>normalize(item.name)===partKey&&(!familyKey||item.families.some(name=>normalize(name)===familyKey)));
  const standardizedCodes=standardized?new Set(standardized.codes):null;
  return data.parts.filter(row=>{
    if(row[4]!==null&&row[4]<=0)return false;
    const rowCode=materialCode(row[3]);
    if(standardizedCodes)return standardizedCodes.has(rowCode);
    return (normalize(row[3])===partKey||(code&&rowCode===code))&&(!familyKey||normalize(row[7]||"Sem família informada")===familyKey);
  }).sort((a,b)=>b[0].localeCompare(a[0])||b[6]-a[6]);
}

export function formatDate(value:string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Não informado";
  return value.slice(8,10)+"/"+value.slice(5,7)+"/"+value.slice(0,4);
}
