'use client';
import {useMemo,useState} from 'react';
import {Battery,CircleDot,Droplets,Cog,Wrench} from 'lucide-react';
import {formatDate as date,formatPrefix,formatRecordNumber,normalize,type PartRow,type ServiceRow,type Summary} from '@/lib/fleet';
import {normalizeOperationalPrefix} from '@/lib/import-pipeline';
import {validDate} from '@/lib/validated-search';
import {csvDocument,downloadData} from '@/lib/export-data';
import {useVehicle} from './use-vehicle';
const number=(n:number)=>n.toLocaleString('pt-BR');
type MovementClass='issue'|'return'|'reversal'|'entry'|'adjustment'|'unknown';
const movementLabels={issue:'Quantidade positiva',return:'Devolução provável',reversal:'Estorno provável',entry:'Entrada',adjustment:'Ajuste',unknown:'Natureza não informada'};
const originId=(kind:'part'|'service',position:number)=>(kind==='part'?'EXT-':'LST-')+String(position).padStart(7,'0');
const reversalKey=(row:PartRow)=>JSON.stringify([row[0],row[1],row[3],row[4]]);
function nature(row:PartRow,positives:Set<string>):MovementClass{
 if(row[4]===null)return 'unknown';if(row[4]===0)return 'adjustment';if(row[4]>0)return 'issue';
 if(!row[1])return 'unknown';
 return positives.has(JSON.stringify([row[0],row[1],row[3],-row[4]]))?'reversal':'return';
}
export function MaintenanceMemory({summary,selected,onSelect}:{summary:Summary|null;selected:string;onSelect:(s:string)=>void}){
 const {data,error,retry}=useVehicle(selected),[prefix,setPrefix]=useState(''),[invalid,setInvalid]=useState(''),[query,setQuery]=useState(''),[tab,setTab]=useState('parts'),[quality,setQuality]=useState('all'),[from,setFrom]=useState(''),[to,setTo]=useState('');
 const [pagination,setPagination]=useState({code:selected,page:1}),page=pagination.code===selected?pagination.page:1;
 function setPage(page:number){setPagination({code:selected,page})}
 function reset(){setPage(1)}
 const rangeError=(from&&!validDate(from)||to&&!validDate(to))?'Revise as datas dos filtros.':from&&to&&from>to?'A data inicial deve ser anterior ou igual à data final.':'';
 const positives=useMemo(()=>new Set((data?.parts||[]).filter(row=>!!row[1]&&(row[4]??0)>0).map(reversalKey)),[data]);
 const rows=useMemo(()=>{
  if(rangeError)return [];
  const term=normalize(query).replace(/(\d)\.(?=\d)/g,'$1');
  let parts=(data?.parts||[]).filter(r=>(!from||r[0]>=from)&&(!to||r[0]<=to)&&normalize([r[3],r[1],r[7],r[8],r[5],originId('part',r[6]),'EXT-'+r[6]].join(' ')).includes(term)&&(quality==='all'||quality==='identifier'&&!!r[1]||quality==='responsible'&&!!r[5]||quality==='detail'&&!!r[7]));
  const services=(data?.services||[]).filter(r=>(!from||r[0]>=from)&&(!to||r[0]<=to)&&normalize([r[1],r[2],r[3],r[5],originId('service',r[6]),'LST-'+r[6]].join(' ')).includes(term)&&(quality==='all'||quality==='identifier'&&!!r[1]||quality==='responsible'&&!!r[2]||quality==='detail'&&!!r[5]));
  if(tab==='repeats'){const counts=new Map<string,number>();for(const r of parts)if((r[4]??0)>0)counts.set(r[3],(counts.get(r[3])||0)+1);parts=parts.filter(r=>(r[4]??0)>0&&(counts.get(r[3])||0)>1)}
  return (tab==='services'?services:parts).sort((a,b)=>b[0].localeCompare(a[0])||b[6]-a[6]);
 },[data,rangeError,from,to,query,quality,tab]);
 function exportData(){
  if(!data||rangeError)return;
  const values=tab==='services'?
   [['Prefixo','Data','Nº Ficha','Defeito alegado','Providência','Responsável','O.S.','Ocorrência (origem)','ID origem','Posição na Planilha'],...(rows as ServiceRow[]).map(r=>[formatPrefix(selected),r[0],r[1],r[5],r[3],r[2],r[7],r[4],originId('service',r[6]),r[6]])]:
   [['Prefixo','Data','KM','O.S.','Peça','Família','Quantidade','Responsável','Lançamento','Horário','ID origem','Posição na Planilha','Natureza (classificação provável)'],...(rows as PartRow[]).map(r=>[formatPrefix(selected),r[0],r[2],r[1],r[3],r[7],r[4],r[5],r[8],r[9],originId('part',r[6]),r[6],movementLabels[nature(r,positives)]])];
  downloadData(csvDocument(values),'jarvis-manutencao-'+formatPrefix(selected)+'-'+tab+'.csv','text/csv;charset=utf-8');
 }
 return <section className="maintenance-memory">
  <div className="section-title"><div><span className="eyebrow">Memória do veículo</span><h2>{formatPrefix(selected)}{data?.model?' · '+data.model:''}</h2></div><button className="text-action" disabled={!data||!!error||!rows.length||!!rangeError} onClick={exportData}>Exportar seleção completa</button></div>
  <form className="inline-filters" onSubmit={e=>{
   e.preventDefault();const canonical=normalizeOperationalPrefix(prefix||formatPrefix(selected)),code=canonical?String(Number(canonical)-55000):'';
   if(summary?.fleet.some(vehicle=>vehicle.code===code)){onSelect(code);setInvalid('');reset()}else setInvalid('Informe um prefixo operacional cadastrado, de 001 a 559.');
  }}>
   <label>Prefixo<div className="compact-input"><input value={prefix} inputMode="numeric" maxLength={5} placeholder={formatPrefix(selected)} onChange={e=>setPrefix(e.target.value)}/><button>Abrir</button></div></label>
   <label>Peça, serviço ou lançamento<input value={query} onChange={e=>{setQuery(e.target.value);reset()}}/></label>
   <label>Desde<input type="date" value={from} onChange={e=>{setFrom(e.target.value);reset()}}/></label>
   <label>Até<input type="date" min={from||undefined} value={to} onChange={e=>{setTo(e.target.value);reset()}}/></label>
   <label>Informações<select value={quality} onChange={e=>{setQuality(e.target.value);reset()}}><option value="all">Todas</option><option value="identifier">Com O.S. / ficha</option><option value="responsible">Com responsável</option><option value="detail">Com família / defeito alegado</option></select></label>
  </form>{invalid&&<p className="inline-warning" role="alert">{invalid}</p>}{rangeError&&<p className="inline-warning" role="alert">{rangeError}</p>}
  <div className="section-title"><div className="view-switch">{[['parts','Peças'],['services','Serviços'],['repeats','Repetições']].map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>{setTab(id);reset()}}>{label}</button>)}</div><span role="status">{data&&!error&&!rangeError?rows.length.toLocaleString('pt-BR')+' registros':'—'}</span></div>
  {error?<div className="resource-error" role="alert"><p>{error}</p><button className="action-secondary" onClick={retry}>Tentar novamente</button></div>:!data?<p role="status">Carregando histórico…</p>:!rangeError&&<div className="timeline">{rows.slice((page-1)*15,page*15).map((row,i)=>{
   if(tab==='services'){const r=row as ServiceRow;return <HistoryCard key={r[6]+'-'+i} kind="service" title={r[5]} action={r[3]} recordDate={r[0]} code={selected} ficha={r[1]} responsible={r[2]} position={r[6]} sourceId={originId('service',r[6])}/>}
   const r=row as PartRow;return <HistoryCard key={r[6]+'-'+i} kind="part" title={r[3]} family={r[7]} recordDate={r[0]} code={selected} km={r[2]} os={r[1]} quantity={r[4]} responsible={r[5]} position={r[6]} document={r[8]} sourceId={originId('part',r[6])} movement={nature(r,positives)}/>
  })}{!rows.length&&<p className="empty-message">Nenhum registro para estes critérios.</p>}</div>}
  {rows.length>15&&<div className="page-controls"><button disabled={page===1} onClick={()=>setPage(page-1)}>Anterior</button><span>{page} de {Math.ceil(rows.length/15)}</span><button disabled={page>=Math.ceil(rows.length/15)} onClick={()=>setPage(page+1)}>Próxima</button></div>}
  <p className="data-note">Repetições são movimentos positivos do mesmo material, não comprovação de defeito. Devoluções e estornos prováveis exigem conferência na origem. Registros sem natureza suficiente permanecem não classificados.</p>
 </section>;
}
function HistoryCard({document,kind,title,recordDate,code,km,os,ficha,quantity,responsible,position,sourceId,movement,family,action,repeat=false}:{document?:string|null;kind:"part"|"service";title:string;recordDate:string;code:string;km?:number|null;os?:string;ficha?:string;quantity?:number|null;responsible?:string|null;position:number;sourceId:string;movement?:MovementClass;family?:string;action?:string;repeat?:boolean}){
  const primary=kind==="part"?[`Prefixo: ${formatPrefix(code)}`,...(km!==undefined&&km!==null?[`KM: ${number(km)}`]:[]),...(os?[`O.S.: ${formatRecordNumber(os)}`]:[])]:[`Prefixo: ${formatPrefix(code)}`,...(ficha?[`Nº Ficha: ${formatRecordNumber(ficha)}`]:[])];
  const secondary=kind==="part"?[`${repeat?"Repetições":"Quantidade"}: ${quantity??"Não informada"}`,`Responsável: ${responsible||"Não informado"}`,...(document?[`Lançamento: ${document}`]:[]),`ID: ${sourceId}`,`Posição na Planilha: ${position}`]:[`Responsável: ${responsible||"Não informado"}`,`ID: ${sourceId}`,`Posição na Planilha: ${position}`];
  return <article className={`timeline-card glass ${movement?`movement-${movement}`:""}`}><span className="timeline-dot" aria-hidden="true"/><span className="time-icon">{kind==="part"?<PartIcon title={title}/>:<Wrench strokeWidth={1.2}/>}</span><div className="history-card-body"><div className="record-kicker"><span>{repeat?"SAÍDAS REPETIDAS":kind==="part"?"PEÇAS":"SERVIÇOS"}</span><div>{movement&&<em className={`movement-tag ${movement}`}>{movementLabels[movement]}</em>}<time dateTime={recordDate||undefined}>{recordDate?date(recordDate):"Data não informada"}</time></div></div>{title&&<h3>{title}</h3>}{kind==="part"&&family&&<p className="family">Família: {family}</p>}<MetaLine items={primary}/><MetaLine items={secondary} subtle/>{kind==="service"&&action&&<p className="alleged">Providência executada: {action}</p>}</div></article>;
}

function MetaLine({items,subtle=false}:{items:string[];subtle?:boolean}){return <p className={`meta-line ${subtle?"subtle":""}`}>{items.map((item,i)=><span key={`${item}-${i}`}>{i>0&&<b aria-hidden="true"> - </b>}{item}</span>)}</p>}

function PartIcon({title}:{title:string}){const value=normalize(title);if(/bateria/.test(value))return <Battery strokeWidth={1.2}/>;if(/freio|disco|tambor|pastilha/.test(value))return <CircleDot strokeWidth={1.2}/>;if(/oleo|fluido|graxa/.test(value))return <Droplets strokeWidth={1.2}/>;return <Cog strokeWidth={1.2}/>;}
