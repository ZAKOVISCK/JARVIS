import {formatPrefix,normalize,type FleetItem,type VehicleData} from './fleet.ts';
import type {CognitiveIndex} from './cognitive.ts';

export type FleetFilters={query:string;brand:string;model:string;year:string;presence:string;repeats:boolean;from:string;to:string;sort:string};
export type FleetGrouping='model'|'brand'|'year'|'pattern';
export type FleetGroup={key:string;label:string;context:string;rows:FleetItem[]};
export const defaultFleetFilters:FleetFilters={query:'',brand:'all',model:'all',year:'all',presence:'all',repeats:false,from:'',to:'',sort:'prefix'};
export function vehicleProfileWarnings(vehicle:FleetItem|null){
 if(!vehicle)return [];
 const warnings:string[]=[];
 if(/^[A-Z]{3}[ -]?\d[A-Z0-9]\d{2}$/i.test(vehicle.brand||''))warnings.push('O campo Marca se parece com uma placa. Confira o cadastro original; o valor não foi corrigido por inferência.');
 return warnings;
}

export function filterFleet(fleet:readonly FleetItem[],filters:FleetFilters,index:CognitiveIndex|null){
 const query=normalize(filters.query.trim()),numeric=/^\d{1,3}$|^55\d{3}$/.test(query),prefix=numeric?formatPrefix(query):'';
 const tokens=query.replace(/-/g,'').split(/\s+/).filter(Boolean);
 return fleet.filter(v=>{
  const text=normalize([formatPrefix(v.code),v.code.padStart(3,'0'),v.brand,v.model,v.plate].join(' ')).replace(/-/g,'');
  return (!query||(numeric?formatPrefix(v.code)===prefix:tokens.every(t=>text.includes(t))))
   &&(filters.brand==='all'||v.brand===filters.brand)&&(filters.model==='all'||v.model===filters.model)
   &&(filters.year==='all'||String(v.year||'Não informado')===filters.year)
   &&(filters.presence==='all'||filters.presence==='parts'&&v.parts>0||filters.presence==='services'&&v.services>0||filters.presence==='both'&&v.parts>0&&v.services>0)
   &&(!filters.repeats||!!index?.vehicles[v.code]?.repeats.length)
   &&(!filters.from||v.last>=filters.from)&&(!filters.to||v.last<=filters.to);
 }).sort((a,b)=>filters.sort==='recent'?b.last.localeCompare(a.last)||Number(a.code)-Number(b.code):filters.sort==='records'?b.parts+b.services-a.parts-a.services||Number(a.code)-Number(b.code):Number(a.code)-Number(b.code));
}
export function groupFleet(fleet:readonly FleetItem[],grouping:FleetGrouping,index:CognitiveIndex|null):FleetGroup[]{
 const groups=new Map<string,FleetGroup>();
 for(const vehicle of fleet){
  const label=grouping==='brand'?vehicle.brand||'Marca não informada':grouping==='year'?String(vehicle.year||'Ano não informado'):grouping==='pattern'?index?.vehicles[vehicle.code]?.repeats[0]?.part||'Sem repetição documental':vehicle.model||'Modelo não informado';
  const key=grouping==='model'?`${vehicle.brand||''}|${label}`:label;
  const current=groups.get(key)||{key,label,context:grouping==='model'?vehicle.brand||'Marca não informada':grouping==='pattern'?'Repetição em documentos, não diagnóstico':'Agrupamento cadastral',rows:[]};
  current.rows.push(vehicle);groups.set(key,current);
 }
 return [...groups.values()].sort((a,b)=>b.rows.length-a.rows.length||a.label.localeCompare(b.label,'pt-BR'));
}
export function comparableVehicles(fleet:readonly FleetItem[],vehicle:FleetItem|null){
 if(!vehicle?.brand||!vehicle.model)return [];
 return fleet.filter(v=>v.code!==vehicle.code&&v.brand===vehicle.brand&&v.model===vehicle.model)
  .sort((a,b)=>Math.abs(Number(a.year)-Number(vehicle.year))-Math.abs(Number(b.year)-Number(vehicle.year))||Number(a.code)-Number(b.code));
}
export function recentFleetEvents(data:VehicleData|null,limit=8){
 if(!data)return [];
 return [...data.parts.map(p=>({id:`EXT-${String(p[6]).padStart(7,'0')}`,date:p[0],title:p[3],kind:'Movimentação de peça',source:'EXTRATO GERAL',row:p[6],reference:p[8]||'',workOrder:p[1],km:p[2]})),
  ...data.services.map(s=>({id:`LST-${String(s[6]).padStart(7,'0')}`,date:s[0],title:s[5]||'Serviço sem defeito alegado informado',kind:'Serviço registrado',source:'LISTAGEM GERAL',row:s[6],reference:s[1],workOrder:s[7],km:null}))]
  .sort((a,b)=>b.date.localeCompare(a.date)||b.row-a.row).slice(0,limit);
}
export function constellationPoints(count:number,width:number,height=480){
 const centerX=width/2,centerY=height/2,candidates:{x:number;y:number}[]=[];
 // Hexagonal packing keeps every 56×48px target separate, including the center.
 for(let row=-4;row<=4;row++)for(let column=-Math.ceil(width/64);column<=Math.ceil(width/64);column++){
  const x=centerX+column*64+(row%2?32:0),y=centerY+row*60;
  if(x>=32&&x<=width-32&&y>=32&&y<=height-32)candidates.push({x,y});
 }
 return candidates.sort((a,b)=>Math.hypot(a.x-centerX,a.y-centerY)-Math.hypot(b.x-centerX,b.y-centerY)||Math.atan2(a.y-centerY,a.x-centerX)-Math.atan2(b.y-centerY,b.x-centerX)).slice(0,count);
}
