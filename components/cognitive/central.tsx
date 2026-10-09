'use client';

import {useMemo,useState} from 'react';
import {BusFront,CalendarDays,Check,ChevronDown,Clock3,Database,Disc3,Fan,FileSearch,Gauge,GitBranch,Search,Settings2,Wrench,Zap} from 'lucide-react';
import {formatDate,formatPrefix,formatRecordNumber,normalize,type Summary,type CatalogData} from '@/lib/fleet';
import {systems,clientId,type SystemId,type CognitiveIndex,type InvestigationIntent} from '@/lib/cognitive';
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {SceneModel} from './scene-model';
import {CommandBar} from './command-bar';
import {useVehicle} from './use-vehicle';

const icons={motor:Gauge,transmissao:Settings2,freios:Disc3,arrefecimento:Fan,eletrico:Zap};
const familyWords:Record<SystemId,string[]>={motor:['motor'],transmissao:['cambio','embreagem','transmissao'],freios:['freio'],arrefecimento:['arrefecimento'],eletrico:['eletric']};
const number=(n:number|undefined)=>n===undefined?'—':n.toLocaleString('pt-BR');
type CentralProps={summary:Summary|null;index:CognitiveIndex|null;catalog:CatalogData|null;selected:string;onSelect:(s:string)=>void;onInvestigate:(i:InvestigationIntent)=>void;onFleet:()=>void;onHistory:(s:string)=>void;monitor:boolean};

export function Central({summary,index,catalog,selected,onSelect,onInvestigate,onFleet,onHistory,monitor}:CentralProps){
  const [system,setSystem]=useState<SystemId>('motor');
  const [baseExpanded,setBaseExpanded]=useState(false);
  const [systemOpen,setSystemOpen]=useState(false);
  const [vehicleOpen,setVehicleOpen]=useState(false),[recordsOpen,setRecordsOpen]=useState(false);
  const [filter,setFilter]=useState(''),[page,setPage]=useState(1),[recordPage,setRecordPage]=useState(1);
  const [plainView,setPlainView]=useState(false),[memoryRow,setMemoryRow]=useState<number|null>(null);
  const vehicle=summary?.fleet.find(v=>v.code===selected)||null,vi=index?.vehicles[selected];
  const active=systems.find(s=>s.id===system)!,Icon=icons[system],stats=vi?.systems[system];
  const {data,error,retry}=useVehicle(selected);
  const rows=useMemo(()=>(data?.parts||[]).filter(r=>familyWords[system].some(w=>normalize(r[7]||'').includes(w))).sort((a,b)=>b[0].localeCompare(a[0])||b[6]-a[6]),[data,system]);
  const peers=useMemo(()=>!vehicle||!summary?[]:summary.fleet.filter(v=>v.code!==selected&&v.brand===vehicle.brand).sort((a,b)=>Number(b.model===vehicle.model)-Number(a.model===vehicle.model)||Math.abs(Number(a.year)-Number(vehicle.year))-Math.abs(Number(b.year)-Number(vehicle.year))||Number(a.code)-Number(b.code)).slice(0,3),[summary,vehicle,selected]);
  const filteredFleet=useMemo(()=>{const term=normalize(filter.trim());return (summary?.fleet||[]).filter(v=>normalize([formatPrefix(v.code),v.code.padStart(3,'0'),v.plate,v.brand,v.model].join(' ')).includes(term))},[summary,filter]);
  function investigate(part?:string,query?:string){onInvestigate({id:clientId(),prefix:formatPrefix(selected),part,query,system})}
  function chooseSystem(id:SystemId){setSystem(id);setRecordPage(1);setMemoryRow(null)}
  function chooseVehicle(code:string){onSelect(code);setVehicleOpen(false);setRecordPage(1);setMemoryRow(null)}
  function openVehicles(){setFilter('');setPage(1);setVehicleOpen(true)}


  const recentRows=rows.slice(0,5).reverse();
  const memoryEntry=recentRows.find(r=>r[6]===memoryRow)||recentRows[recentRows.length-1];

  return <section className="cognitive-home" aria-labelledby="central-title">
    <h1 id="central-title" className="sr-only">Central cognitiva da frota</h1>
    <div className="scene-mobile-base" aria-label="Base integrada"><span><BusFront size={18}/><b>{number(summary?.fleet.length)}</b> veículos</span><span><Database size={18}/><b>{summary?number(summary.counts.p+summary.counts.s):'—'}</b> registros</span></div>
    <div className="fleet-scene">
      <aside className="scene-context" aria-label="Identidade e sistemas do veículo">
        <section className="scene-identity orbit-surface">
          <span className="scene-panel-label">Veículo selecionado</span>
          <button className="scene-vehicle" onClick={openVehicles} disabled={!summary}><span className="scene-vehicle-symbol"><BusFront size={32}/></span><span><b>{vehicle?'Prefixo '+formatPrefix(selected):'Carregando veículo'}</b><small>{vehicle?.brand||'Marca não informada'} · {vehicle?.model||'Modelo não informado'}</small></span><Settings2 size={18}/></button>
          <div className="scene-identity-meta"><span>Placa <b>{vehicle?.plate||'Não informada'}</b></span><span>Ano <b>{vehicle?.year||'Não informado'}</b></span></div>
          <button className="scene-base-toggle" aria-expanded={baseExpanded} aria-controls="scene-base-sheet" onClick={()=>setBaseExpanded(true)}><Database size={15}/>Detalhes da base</button>
        </section>
        <section className={'scene-system-selector orbit-surface '+(systemOpen?'is-expanded':'is-collapsed')} aria-label="Selecionar sistema">
          <h2>Sistemas do veículo</h2>
          <button className="scene-systems-toggle" aria-expanded={systemOpen} aria-controls="scene-system-options" onClick={()=>setSystemOpen(!systemOpen)}><span>Sistemas do veículo</span><b>{active.label}</b><ChevronDown size={18}/></button>
          <div className="scene-system-list" id="scene-system-options">{systems.map(s=>{const SystemIcon=icons[s.id];return <button key={s.id} aria-pressed={system===s.id} onClick={()=>chooseSystem(s.id)}><SystemIcon size={24}/><span>{s.label}</span><span className="scene-selection-mark" aria-hidden="true"/></button>})}</div>
        </section>
      </aside>

      <div className="scene-investigation-stack">
      {!monitor&&<div className="scene-command"><CommandBar compact catalog={catalog} prefix={formatPrefix(selected)} onSubmit={q=>investigate(undefined,q)} onSelectVehicle={openVehicles}/></div>}
      <SceneModel vehicle={vehicle} index={vi} selected={system} onSystem={chooseSystem} plain={plainView} onPlainChange={()=>setPlainView(!plainView)}/>
      </div>

      <aside className="scene-evidence" aria-label={'Contexto de '+active.label}>
        <section className="scene-evidence-card orbit-surface">
          <div className="scene-panel-heading"><h2>Evidências do sistema</h2><span><Icon size={18}/>{active.label}</span></div>
          <div className="scene-evidence-awaiting">
            <span className="scene-evidence-glyph" aria-hidden="true"><FileSearch size={32}/></span>
            <h3>Selecione uma peça para consultar</h3>
            <p>Documento · Quantidade · Origem</p>
            {!monitor&&<button className="scene-primary" disabled={!vehicle} onClick={()=>investigate(undefined,'histórico de '+active.query+' do prefixo '+formatPrefix(selected))}>Iniciar investigação</button>}
          </div>
          <div className="scene-source-summary"><span><b>{number(stats?.count)}</b> movimentações na família</span><span>Último registro <b>{stats?.last?formatDate(stats.last):stats?'Sem registros':'Carregando…'}</b></span>{!monitor&&<button className="scene-link" disabled={!vehicle} onClick={()=>setRecordsOpen(true)}>Ver origem</button>}</div>
          <p className="scene-source-note">EXTRATO GERAL · Movimentação não comprova instalação.</p>
        </section>
        <section className="scene-memory orbit-surface" aria-label="Memória recente do sistema">
          <h2><Clock3 size={19}/>Memória temporal</h2>
          <p className="scene-memory-label">Movimentações desta família</p>
          {error?<div className="resource-error" role="alert"><p>Os registros de origem estão indisponíveis.</p><button className="text-action" onClick={retry}>Tentar novamente</button></div>:!data?<p role="status">Carregando memória…</p>:recentRows.length?<><div className="scene-memory-track" role="group" aria-label="Selecionar uma movimentação recente">{recentRows.map(r=><button key={r[6]} className="scene-memory-point" aria-pressed={memoryEntry?.[6]===r[6]} aria-label={formatDate(r[0])+' · '+r[3]+' · Linha '+r[6]} title={formatDate(r[0])+' · '+r[3]} onClick={()=>setMemoryRow(r[6])}><span aria-hidden="true"/></button>)}</div>{memoryEntry&&<div className="scene-memory-preview" role="status"><time dateTime={memoryEntry[0]}>{formatDate(memoryEntry[0])}</time><strong>{memoryEntry[3]}</strong><span>EXT-{String(memoryEntry[6]).padStart(7,'0')}</span></div>}</>:<p>Sem movimentações desta família na base integrada.</p>}
          {!monitor&&<button className="scene-link" disabled={!vehicle} onClick={()=>onHistory(selected)}>Abrir memória do veículo</button>}
        </section>
      </aside>
    </div>

    {!monitor&&!!peers.length&&<div className="scene-related-fleet" aria-label="Veículos da mesma marca"><span><GitBranch size={17}/>Da mesma marca</span>{peers.map(v=><button className="scene-neighbor" key={v.code} onClick={()=>chooseVehicle(v.code)} title={formatPrefix(v.code)+' · '+v.model+'. Similaridade cadastral, sem inferir compatibilidade.'}><BusFront size={18}/><b>{formatPrefix(v.code)}</b><small>{v.year||'Ano não informado'}</small></button>)}<button className="scene-link" onClick={onFleet}>Abrir frota</button></div>}
    <p className="sr-only" role="status">{active.label} do prefixo {formatPrefix(selected)}: {number(stats?.count)} movimentações. Último registro: {stats?.last?formatDate(stats.last):'não localizado'}.</p>

    <Sheet open={baseExpanded} onOpenChange={setBaseExpanded}><SheetContent className="query-detail-sheet home-detail-sheet" id="scene-base-sheet"><SheetHeader><SheetTitle>Base integrada</SheetTitle><SheetDescription>Informações reais das planilhas preservadas pelo Jarvis.</SheetDescription></SheetHeader><div className="query-detail-body"><dl className="scene-base-facts"><div><dt><BusFront size={20}/>Veículos operacionais</dt><dd>{number(summary?.fleet.length)}</dd></div><div><dt><Database size={20}/>Registros preservados</dt><dd>{summary?number(summary.counts.p+summary.counts.s):'—'}</dd></div><div><dt><Wrench size={20}/>Serviços registrados</dt><dd>{number(summary?.counts.s)}</dd></div><div><dt><CalendarDays size={20}/>Último registro na base</dt><dd>{index?formatDate(index.latest):'Carregando…'}</dd></div></dl><p className="data-note">Frota operacional de 001 a 559. A data exibida corresponde ao último registro das fontes, não ao horário de sincronização.</p></div></SheetContent></Sheet>
    <Sheet open={vehicleOpen} onOpenChange={setVehicleOpen}><SheetContent className="query-detail-sheet home-detail-sheet"><SheetHeader><SheetTitle>Selecionar veículo</SheetTitle><SheetDescription>A identidade e os registros da central acompanham o prefixo selecionado.</SheetDescription></SheetHeader><div className="query-detail-body"><label className="scene-fleet-search"><span>Prefixo, placa, marca ou modelo</span><div><Search size={19}/><input type="search" value={filter} onChange={e=>{setFilter(e.target.value);setPage(1)}} placeholder="Busque na frota operacional"/></div></label><p className="scene-list-count" role="status">{number(filteredFleet.length)} veículos encontrados</p><div className="scene-vehicle-options">{filteredFleet.slice((page-1)*24,page*24).map(v=><button key={v.code} aria-pressed={v.code===selected} onClick={()=>chooseVehicle(v.code)}><BusFront size={23}/><span><b>{formatPrefix(v.code)}</b><small>{v.brand} · {v.model}</small><small>{v.plate||'Placa não informada'} · {v.year||'Ano não informado'}</small></span>{v.code===selected&&<Check size={20}/>}</button>)}</div>{!filteredFleet.length&&<p>Nenhum veículo localizado. Tente outro prefixo, placa ou modelo.</p>}{filteredFleet.length>24&&<div className="page-controls"><button disabled={page===1} onClick={()=>setPage(page-1)}>Anterior</button><span>{page} de {Math.ceil(filteredFleet.length/24)}</span><button disabled={page*24>=filteredFleet.length} onClick={()=>setPage(page+1)}>Próxima</button></div>}</div></SheetContent></Sheet>

    <Sheet open={recordsOpen} onOpenChange={setRecordsOpen}><SheetContent className="query-detail-sheet home-detail-sheet"><SheetHeader><SheetTitle>{active.label} · {formatPrefix(selected)}</SheetTitle><SheetDescription>Registros da família no EXTRATO GERAL. Confira o documento e a quantidade antes de considerar uma saída confirmada.</SheetDescription></SheetHeader><div className="query-detail-body"><div className="scene-detail-facts"><span><strong>{number(vehicle?.services)}</strong>serviços do veículo</span><span><strong>{number(vehicle?.parts)}</strong>movimentações do veículo</span></div>{error?<div className="resource-error" role="alert"><p>{error}</p><button className="action-secondary" onClick={retry}>Tentar novamente</button></div>:!data?<p role="status">Carregando registros de origem…</p>:!rows.length?<p>Nenhuma movimentação associada a esta família na base integrada.</p>:<><p>{number(rows.length)} registros · mais recentes primeiro</p>{rows.slice((recordPage-1)*12,recordPage*12).map(r=><article className="scene-origin-record" key={r[6]}><div><time dateTime={r[0]}>{formatDate(r[0])}</time><span>{r[4]===null?'Quantidade não informada':r[4]>0?'Movimento positivo':r[4]<0?'Movimento negativo':'Quantidade zero'}</span></div><h3>{r[3]}</h3><p>Família: {r[7]||'Não informada'}</p><dl><div><dt>KM</dt><dd>{r[2]===null?'Não informado':number(r[2])}</dd></div><div><dt>Quantidade</dt><dd>{r[4]===null?'Não informada':number(r[4])}</dd></div><div><dt>O.S.</dt><dd>{formatRecordNumber(r[1])}</dd></div><div><dt>Lançamento</dt><dd>{r[8]||'Não informado'}</dd></div></dl><small>EXT-{String(r[6]).padStart(7,'0')} · Posição na Planilha: {r[6]}</small><button className="scene-link" onClick={()=>{setRecordsOpen(false);investigate(r[3])}}>Investigar esta peça</button></article>)}{rows.length>12&&<div className="page-controls"><button disabled={recordPage===1} onClick={()=>setRecordPage(recordPage-1)}>Anterior</button><span>{recordPage} de {Math.ceil(rows.length/12)}</span><button disabled={recordPage*12>=rows.length} onClick={()=>setRecordPage(recordPage+1)}>Próxima</button></div>}</>}</div></SheetContent></Sheet>
  </section>;
}
