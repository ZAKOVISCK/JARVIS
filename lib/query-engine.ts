import {
  findCatalogMaterial,
  findExactPartRows,
  findMatches,
  findVehicleCode,
  formatPrefix,
  materialCode,
  normalize,
  normalizeReferenceNumbers,
  queryTokens,
  type CatalogData,
  type PartRow,
  type ServiceRow,
  type StandardizedPart,
  type Summary,
  type VehicleData,
} from "./fleet.ts";
import {normalizeOperationalPrefix} from './import-pipeline.ts';
import {dayInBrazil,validDate} from './validated-search.ts';

export type QueryDomain = "parts" | "services" | "mixed";
export type QueryAction = "latest" | "history" | "replacement" | "stock";
export type EvidenceStatus = "stock_issue" | "linked_service" | "confirmed_replacement";

export type QueryPeriod = {
  from: string | null;
  to: string | null;
  label: string;
};

export type QueryPlan = {
  raw: string;
  prefix: string | null;
  domain: QueryDomain;
  action: QueryAction;
  os: string | null;
  ficha: string | null;
  materialCode: string | null;
  standardizedPartId: string | null;
  standardizedPartName: string | null;
  period: QueryPeriod | null;
  interpretation: string[];
  issues?: string[];
};

export type PartEvidence = {
  row: PartRow;
  linkedServices: ServiceRow[];
  confirmingServices: ServiceRow[];
  status: EvidenceStatus;
  stockResponsible: string | null;
  serviceResponsibles: string[];
};

export type ServiceEvidence = {
  row: ServiceRow;
  relatedParts: PartRow[];
};

export type QueryExecution = {
  plan: QueryPlan;
  parts: PartEvidence[];
  services: ServiceEvidence[];
};

function isoDate(date:Date) {
  return date.toISOString().slice(0,10);
}

function parseBrazilianDate(value:string) {
  const [day,month,year]=value.split("/");
  return `${year}-${month}-${day}`;
}

function shiftDate(now:Date,amount:number,unit:"days"|"months"|"years") {
  const result=new Date(now);
  if(unit==="days")result.setUTCDate(result.getUTCDate()-amount);
  else {const day=result.getUTCDate();result.setUTCDate(1);if(unit==="months")result.setUTCMonth(result.getUTCMonth()-amount);else result.setUTCFullYear(result.getUTCFullYear()-amount);const last=new Date(Date.UTC(result.getUTCFullYear(),result.getUTCMonth()+1,0)).getUTCDate();result.setUTCDate(Math.min(day,last));}
  return result;
}

function parsePeriod(query:string,now:Date):QueryPeriod|null {
  const local=new Date(dayInBrazil(now)+'T12:00:00Z');
  const dates=[...query.matchAll(/\b(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/g)].map(match=>match[1].includes('/')?parseBrazilianDate(match[1]):match[1]);
  if(dates.length>=2)return {from:dates[0],to:dates[1],label:`${dates[0]} a ${dates[1]}`};
  if(dates.length===1)return {from:dates[0],to:dates[0],label:dates[0]};
  const relative=normalize(query).match(/\b(?:ultim[oa]s?|nos ultimos)\s+(\d{1,3})\s+(dias?|mes(?:es)?|anos?)\b/i);
  if(relative){
    const amount=Number(relative[1]);
    const raw=normalize(relative[2]);
    const unit=raw.startsWith("dia")?"days":raw.startsWith("mes")?"months":"years";
    const labelUnit=unit==='days'?(amount===1?'dia':'dias'):unit==='months'?(amount===1?'mês':'meses'):(amount===1?'ano':'anos');
    return {from:isoDate(shiftDate(local,amount,unit)),to:isoDate(local),label:`${amount===1?'Último':'Últimos'} ${amount} ${labelUnit}`};
  }
  const year=query.match(/\b(20\d{2})\b/)?.[1];
  if(year)return {from:`${year}-01-01`,to:`${year}-12-31`,label:year};
  return null;
}

function resolveStandardizedPart(query:string,catalog:CatalogData|null|undefined):StandardizedPart|null {
  const tokens=queryTokens(query);
  const matches=(catalog?.standardizedParts||[]).filter(part=>[part.name,...part.aliases].some(label=>{
    const labelTokens=queryTokens(label);
    return labelTokens.length>0&&labelTokens.every(token=>tokens.includes(token));
  }));
  return matches.length===1?matches[0]:null;
}

function requestedMaterialCode(query:string,prefix:string|null,os:string|null,ficha:string|null) {
  return [...query.matchAll(/\b\d{4,6}\b/g)].map(match=>match[0]).find(value=>value!==prefix&&value!==os&&value!==ficha&&!/^(?:19|20)\d{2}$/.test(value))??null;
}

export function interpretQuery(query:string,summary:Summary,catalog?:CatalogData|null,now=new Date()):QueryPlan {
  query=normalizeReferenceNumbers(query);
  const normalized=normalize(query);
  const mentions=[...normalized.matchAll(/\b(?:prefixos?|carros?|veiculos?|onibus)\s*(?:n[º°.]?\s*)?[:#-]?\s*(\d{1,5}(?:\s*(?:,|;|\be\b)\s*\d{1,5})*)\b/g)];
  const explicit=mentions.flatMap(m=>m[1].split(/\s*(?:,|;|\be\b)\s*/)).map(p=>normalizeOperationalPrefix(p));
  const issues:string[]=[];
  if(explicit.some(p=>!p))issues.push('Há um prefixo fora da frota operacional. Use 001 a 559 ou 55001 a 55559.');
  if(new Set(explicit.filter(Boolean)).size>1)issues.push('A pergunta contém vários veículos. Use a pesquisa em lote para consultar cada combinação.');
  const bare=normalized.replace(/\b(?:o\.?s\.?|ordem\s+de\s+servico|ficha|codigo|cod|material)\s*[nº°.:#-]*\s*\d[\d.]*/g,' ');
  if(!mentions.length&&new Set([...bare.matchAll(/\b55\d{3}\b/g)].map(m=>m[0])).size>1)issues.push('Há vários prefixos na pergunta. Use a pesquisa em lote.');
  const prefix=mentions.length?(explicit[0]?String(Number(explicit[0])-55000):null):findVehicleCode(query,summary);
  const os=query.match(/\b(?:o\.?s\.?|ordem\s+de\s+servi[cç]o)\s*[nº°:#-]*\s*(\d{4,8})\b/i)?.[1]??null;
  const ficha=query.match(/\bficha\s*[nº°:#-]*\s*(\d{3,8})\b/i)?.[1]??null;
  const standardized=resolveStandardizedPart(query,catalog);
  const code=requestedMaterialCode(query,prefix?formatPrefix(prefix):null,os,ficha);
  const serviceWords=/\b(?:servicos?|defeitos?|ocorrencias?|providencias?|fichas?|manutencao|manutencoes)\b/.test(normalized);
  const partWords=Boolean(standardized||code)||/\b(?:pecas?|materiais|material|saidas?|retiradas?|almoxarifado|extrato|trocas?|substituicoes?)\b/.test(normalized);
  const explicitPartRequest=/\b(?:pecas?|materiais|material|saidas?|retiradas?|almoxarifado|extrato)\b/.test(normalized);
  const domain:QueryDomain=serviceWords&&explicitPartRequest?"mixed":serviceWords?"services":partWords?"parts":os?"mixed":"parts";
  const replacement=/\b(?:trocas?|trocad[oa]s?|substitu(?:icao|icoes|ir|ido|ida|idos|idas)|instalad[oa]s?)\b/.test(normalized);
  const stock=/\b(?:saida|retirada|almoxarifado|extrato)\b/.test(normalized);
  const history=/\b(?:historico|todas|todos|ultimas|ultimos|relacao)\b/.test(normalized);
  const action:QueryAction=replacement?"replacement":stock?"stock":history?"history":"latest";
  const period=parsePeriod(query,now);
  if([...query.matchAll(/\b(?:\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/g)].length>2)issues.push('Há mais de duas datas na pergunta. Informe um único intervalo por consulta.');
  if(period&&([period.from,period.to].some(d=>d&&!validDate(d))||(period.from&&period.to&&period.from>period.to)))issues.push('Período inválido. Confira as datas e a ordem do intervalo.');
  if(/\b(?:ultim[oa]s?|nos ultimos)\s+0\s+(?:dias?|mes(?:es)?|anos?)\b/.test(normalized))issues.push('O período relativo deve ser maior que zero.');
  const interpretation=[
    prefix?`Prefixo ${formatPrefix(prefix)}`:"Prefixo não identificado",
    standardized?.name||(code?`Material ${code}`:domain==="services"?"Serviços":"Peças"),
    action==="replacement"?"Troca solicitada":action==="stock"?"Saída de estoque":action==="history"?"Histórico":"Registro mais recente",
    ...(period?[`Período: ${period.label}`]:[]),
    ...(os?[`O.S. ${os}`]:[]),
    ...(ficha?[`Ficha ${ficha}`]:[]),
  ];
  return {raw:query,prefix,domain,action,os,ficha,materialCode:code,standardizedPartId:standardized?.id??null,standardizedPartName:standardized?.name??null,period,interpretation,issues};
}

/** A stated vehicle always takes precedence; invalid explicit prefixes never fall back. */
export function withVehicleContext(query:string,prefix:string,summary:Summary,catalog?:CatalogData|null){
 const text=query.trim(),plan=interpretQuery(text,summary,catalog),context=normalizeOperationalPrefix(prefix);
 return !text||plan.prefix||/\b(?:prefixos?|carros?|veiculos?|onibus)\b/.test(normalize(text))||!context?text:`${text} do prefixo ${context}`;
}

export function createGuidedPartPlan(prefix:string,part:string,family:string,catalog?:CatalogData|null):QueryPlan {
  const standardized=(catalog?.standardizedParts||[]).find(item=>normalize(item.name)===normalize(part)&&(!family||item.families.some(name=>normalize(name)===normalize(family))));
  return {
    raw:`Última saída de ${part} do prefixo ${formatPrefix(prefix)}`,
    prefix,
    domain:"parts",
    action:"latest",
    os:null,
    ficha:null,
    materialCode:materialCode(part)||null,
    standardizedPartId:standardized?.id??null,
    standardizedPartName:standardized?.name??null,
    period:null,
    interpretation:[`Prefixo ${formatPrefix(prefix)}`,standardized?.name||part,"Registro mais recente"],
  };
}

function inPeriod(value:string,period:QueryPeriod|null) {
  if(!period||!value)return !period;
  return (!period.from||value>=period.from)&&(!period.to||value<=period.to);
}

function sortRows<T extends PartRow|ServiceRow>(rows:T[]) {
  return [...rows].sort((a,b)=>b[0].localeCompare(a[0])||b[6]-a[6]);
}

function confirmsPart(service:ServiceRow,row:PartRow,catalog?:CatalogData|null) {
  // A complaint or request is not proof of completed work. Only the action field
  // can support this evidence label; ambiguous or negated actions stay unconfirmed.
  const text=normalize(service[3]);
  if(/\b(?:nao|sem|pendente|solicitad\w*|necessari\w*|aguard\w*|programad\w*|a realizar)\b/.test(text))return false;
  const completed=/\b(?:trocad[oa]s?|substituid[oa]s?|instalad[oa]s?|montad[oa]s?)\b/.test(text)
    ||/\b(?:feit[oa]|realizad[oa]|executad[oa]|efetuad[oa])\b.{0,50}\b(?:troca|substituicao|instalacao)\b/.test(text)
    ||/\b(?:troca|substituicao|instalacao)\b.{0,50}\b(?:feita|realizada|executada|efetuada)\b/.test(text);
  if(!completed)return false;
  const material=findCatalogMaterial(catalog,row[3]);
  const standardized=(catalog?.standardizedParts||[]).find(item=>item.id===material?.standardizedPartId);
  const labels=standardized?[standardized.name,...standardized.aliases]:[material?.canonical||row[3]];
  return labels.some(label=>{
    const tokens=queryTokens(label).slice(0,3);
    return tokens.length>0&&tokens.every(token=>text.includes(token));
  });
}

export function buildPartEvidence(row:PartRow,data:VehicleData,catalog?:CatalogData|null):PartEvidence {
  const linkedServices=row[1]?sortRows(data.services.filter(service=>service[7]===row[1])):[];
  const confirmingServices=linkedServices.filter(service=>confirmsPart(service,row,catalog));
  const status:EvidenceStatus=confirmingServices.length?"confirmed_replacement":linkedServices.length?"linked_service":"stock_issue";
  return {
    row,
    linkedServices,
    confirmingServices,
    status,
    stockResponsible:row[5],
    serviceResponsibles:[...new Set(linkedServices.map(service=>service[2]).filter((value):value is string=>Boolean(value)))],
  };
}

export function executeQueryPlan(data:VehicleData,plan:QueryPlan,catalog?:CatalogData|null,selection?:{part:string;family?:string}):QueryExecution {
  const found=selection
    ?{parts:findExactPartRows(data,selection.part,selection.family,catalog),services:[] as ServiceRow[]}
    :findMatches(data,plan.raw,catalog);
  const parts=sortRows(found.parts.filter(row=>inPeriod(row[0],plan.period))).map(row=>buildPartEvidence(row,data,catalog));
  const services=sortRows(found.services.filter(row=>inPeriod(row[0],plan.period))).map(row=>({
    row,
    relatedParts:sortRows(data.parts.filter(part=>Boolean(row[7])&&part[1]===row[7]&&(part[4]===null||part[4]>0))),
  }));
  return {plan,parts,services};
}
