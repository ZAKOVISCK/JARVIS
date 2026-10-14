'use client';
import {useEffect,useMemo,useRef,useState,useSyncExternalStore,type KeyboardEvent} from 'react';
import {BusFront,Check,ChevronLeft,ChevronRight,Disc3,Fan,FileText,Focus,Gauge,GitBranch,Layers3,LayoutGrid,List,Search,Settings2,SlidersHorizontal,Wrench,X,Zap} from 'lucide-react';
import {useVirtualizer} from '@tanstack/react-virtual';
import {formatDate,formatPrefix,formatRecordNumber,type FleetItem,type Summary} from '@/lib/fleet';
import {systems,clientId,type CognitiveIndex,type SystemId,type InvestigationIntent} from '@/lib/cognitive';
import {comparableVehicles,vehicleProfileWarnings,defaultFleetFilters,filterFleet,groupFleet,recentFleetEvents,type FleetFilters,type FleetGrouping,type FleetGroup} from '@/lib/fleet-atlas';
import {useVehicle} from './use-vehicle';
import {VehicleVisual} from './vehicle-visual';
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';

const compactSnapshot=()=>window.matchMedia('(max-width:700px)').matches;
const desktopSnapshot=()=>false;
const subscribeCompact=(notify:()=>void)=>{const media=window.matchMedia('(max-width:700px)');media.addEventListener('change',notify);return()=>media.removeEventListener('change',notify)};
const empty:FleetItem[]=[];
const icons={motor:Gauge,transmissao:Settings2,freios:Disc3,arrefecimento:Fan,eletrico:Zap};
const n=(value:number)=>value.toLocaleString('pt-BR');
type Props={summary:Summary|null;index:CognitiveIndex|null;selected:string;onSelect:(s:string)=>void;onInvestigate:(i:InvestigationIntent)=>void;onHistory:(s:string)=>void};

export function FleetAtlas({summary,index,selected,onSelect,onInvestigate,onHistory}:Props){
 const compact=useSyncExternalStore(subscribeCompact,compactSnapshot,desktopSnapshot);
 const [detailOpen,setDetailOpen]=useState(false),[query,setQuery]=useState(''),[search,setSearch]=useState('');
 const [filters,setFilters]=useState<FleetFilters>(defaultFleetFilters),[filtersOpen,setFiltersOpen]=useState(false);
 const [view,setView]=useState<'atlas'|'list'>('atlas'),[grouping,setGrouping]=useState<FleetGrouping>('model'),[groupChoice,setGroupChoice]=useState('');
 const [system,setSystem]=useState<SystemId>('motor'),[detailTab,setDetailTab]=useState('overview');
 const systemStrip=useRef<HTMLDivElement>(null);
 const fleet=summary?.fleet||empty,vehicle=fleet.find(v=>v.code===selected)||null;
 const {data,error,retry}=useVehicle(selected);
 useEffect(()=>{const t=setTimeout(()=>setSearch(query),160);return()=>clearTimeout(t)},[query]);
 const items=useMemo(()=>filterFleet(fleet,{...filters,query:search},index),[fleet,filters,search,index]);
 const groups=useMemo(()=>groupFleet(items,grouping,index),[items,grouping,index]);
 const shownGroups=groupChoice?groups.filter(g=>g.key===groupChoice):groups;
 const peers=useMemo(()=>comparableVehicles(fleet,vehicle),[fleet,vehicle]);
 const events=useMemo(()=>recentFleetEvents(data),[data]);
 const outsideFilters=!!vehicle&&!items.some(v=>v.code===selected);
 const filterCount=['brand','model','year','presence'].filter(k=>filters[k as keyof FleetFilters]!=='all').length+Number(filters.repeats)+Number(!!filters.from)+Number(!!filters.to);
 const showList=compact||view==='list';
 const recordedSystems=systems.filter(s=>(index?.vehicles[selected]?.systems[s.id]?.count||0)>0).length;
 function updateFilter<K extends keyof FleetFilters>(key:K,value:FleetFilters[K]){setFilters(f=>({...f,[key]:value}));setGroupChoice('')}
 function clear(){setQuery('');setSearch('');setFilters(defaultFleetFilters);setGroupChoice('')}
 function select(code:string){onSelect(code);setDetailTab('overview');if(compact)setDetailOpen(true)}
 function investigate(){onInvestigate({id:clientId(),prefix:formatPrefix(selected),system,query:`histórico de ${systems.find(s=>s.id===system)!.query} do prefixo ${formatPrefix(selected)}`})}
 function nextSystems(){const strip=systemStrip.current;if(strip)strip.scrollTo({left:strip.scrollLeft+strip.clientWidth>=strip.scrollWidth-2?0:strip.scrollLeft+strip.clientWidth*.7,behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'})}

 const detail=<section className="fleet-inspector" aria-label="Detalhes do veículo selecionado">
  {!vehicle?<div className="fleet-empty"><BusFront size={32}/><h2>Selecione um veículo</h2><p>A identidade e os registros serão exibidos aqui.</p></div>:<>
   <header className="fleet-identity"><span>Veículo selecionado{outsideFilters&&<small>Fora dos filtros atuais</small>}</span><div><h2>{formatPrefix(selected)}</h2><span className="fleet-plate">{vehicle.plate||'Placa não informada'}</span></div><p>{vehicle.brand||'Marca não informada'} · {vehicle.model||'Modelo não informado'}</p></header>
   {vehicleProfileWarnings(vehicle).map(warning=><p key={warning} className="fleet-profile-warning" role="status">{warning}</p>)}
   <VehicleVisual vehicle={vehicle} illustrativeFallback/>
   <dl className="fleet-profile-facts"><div><dt>Ano cadastral</dt><dd>{vehicle.year||'Não informado'}</dd></div><div><dt>Último registro</dt><dd>{formatDate(vehicle.last)}</dd></div></dl>
   <p className="fleet-operational-note">Estado operacional não informado na fonte.</p>
   <dl className="fleet-vehicle-signals"><div><dt><Layers3 size={21}/><span>Movimentações</span></dt><dd>{n(vehicle.parts)}</dd></div><div><dt><Wrench size={21}/><span>Serviços</span></dt><dd>{n(vehicle.services)}</dd></div><div><dt><GitBranch size={21}/><span>Sistemas com registros</span></dt><dd>{index?n(recordedSystems):'—'}</dd></div></dl>
   <Tabs value={detailTab} onValueChange={setDetailTab} className="fleet-detail-tabs"><TabsList variant="line"><TabsTrigger value="overview">Sistemas</TabsTrigger><TabsTrigger value="memory">Cronologia</TabsTrigger><TabsTrigger value="peers">Semelhantes</TabsTrigger></TabsList>
    <TabsContent value="overview">
     <div className="fleet-system-strip"><div className="fleet-systems" ref={systemStrip} role="group" aria-label="Sistemas para investigar">{systems.map(s=>{const Icon=icons[s.id],stats=index?.vehicles[selected]?.systems[s.id];return <button key={s.id} aria-pressed={system===s.id} onClick={()=>setSystem(s.id)}><Icon size={19}/><span>{s.label}<small>{stats?n(stats.count):'—'} movimentos</small></span>{system===s.id&&<Check size={14}/>}</button>})}</div><button className="fleet-next-systems" aria-label="Mostrar outros sistemas" title="Mostrar outros sistemas" onClick={nextSystems}><ChevronRight size={17}/></button></div>
     <p className="fleet-system-context">{systems.find(s=>s.id===system)!.label} · {index?.vehicles[selected]?.systems[system]?.last?`Último movimento em ${formatDate(index.vehicles[selected].systems[system].last)}`:'Sem data disponível'}.</p>
     <button className="fleet-primary" onClick={investigate}><Search size={20}/>Investigar este veículo<ChevronRight size={18}/></button>
     <p className="fleet-disclosure">Contagens dos sistemas: EXTRATO GERAL. Movimentações não comprovam instalação nem indicam o estado mecânico.</p>
     <div className="fleet-recent"><h3>Registros recentes</h3>{error?<div className="resource-error" role="alert"><p>{error}</p><button className="fleet-secondary" onClick={retry}>Tentar novamente</button></div>:!data?<p role="status">Carregando os registros…</p>:!events.length?<p>Nenhum registro para este prefixo.</p>:<ol>{events.slice(0,2).map(e=><li key={e.id}><button onClick={()=>onHistory(selected)}><FileText size={19}/><span><strong>{formatDate(e.date)} · {e.title}</strong><small>{e.source} · Linha {e.row}</small></span><ChevronRight size={16}/></button></li>)}</ol>}<button className="fleet-history-link" onClick={()=>onHistory(selected)}>Histórico completo<ChevronRight size={15}/></button></div>
    </TabsContent>
    <TabsContent value="memory">{error?<div className="resource-error" role="alert"><p>{error}</p><button className="fleet-secondary" onClick={retry}>Tentar novamente</button></div>:!data?<p role="status" className="fleet-loading">Carregando cronologia do {formatPrefix(selected)}…</p>:!events.length?<p className="fleet-empty">Nenhum registro de manutenção para este prefixo.</p>:<ol className="fleet-timeline">{events.map(e=><li key={e.id}><time dateTime={e.date}>{formatDate(e.date)}</time><small>{e.kind}</small><strong>{e.title}</strong><span>{e.source} · Linha {e.row}<br/>{e.kind==='Serviço registrado'?'Nº Ficha':'Lançamento'}: {e.reference?formatRecordNumber(e.reference):'Não informado'}{e.workOrder&&` · O.S.: ${formatRecordNumber(e.workOrder)}`}{e.km!==null&&` · KM: ${n(e.km)}`}</span></li>)}</ol>}<button className="fleet-secondary" onClick={()=>onHistory(selected)}>Histórico completo do veículo</button></TabsContent>
    <TabsContent value="peers"><div className="fleet-peer-intro"><GitBranch size={20}/><p><strong>{n(peers.length)} veículos</strong> com a mesma marca e modelo cadastral, ordenados pela proximidade do ano.</p></div><div className="fleet-peers">{peers.slice(0,6).map(v=><button key={v.code} onClick={()=>select(v.code)}><b>{formatPrefix(v.code)}</b><span>{v.year||'Ano não informado'} · {v.plate||'Sem placa'}</span></button>)}</div>{!peers.length&&<p>Não há outro veículo com essa combinação cadastral.</p>}<p className="fleet-disclosure">Similaridade cadastral não comprova compatibilidade de peças ou manutenção semelhante.</p>{!!peers.length&&<button className="fleet-secondary" onClick={()=>{setQuery('');setSearch('');setFilters({...defaultFleetFilters,brand:vehicle.brand!,model:vehicle.model!});setGroupChoice('');setDetailOpen(false)}}>Localizar todos os semelhantes</button>}</TabsContent>
   </Tabs>
  </>}
 </section>;

 return <section className="fleet-atlas approved-fleet" aria-labelledby="fleet-title">
  <div className={`fleet-layout ${showList?'is-list':''}`}>
   <div className="fleet-explorer">
    <header className="fleet-heading"><div><h1 id="fleet-title">Explore a frota</h1><p>Selecione um veículo e conecte seu contexto.</p></div><button className="fleet-secondary" aria-expanded={filtersOpen} aria-controls="fleet-filters" onClick={()=>setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={18}/>Filtros{filterCount>0&&<span className="fleet-filter-count">{filterCount}</span>}</button></header>
    <div className="fleet-toolbar"><label className="fleet-search"><Search size={22}/><input type="search" aria-label="Pesquisar na frota" placeholder="Buscar prefixo, placa, marca ou modelo" value={query} onKeyDown={e=>{if(e.key==='Enter'){const matches=filterFleet(fleet,{...filters,query},index);if(matches.length===1){e.preventDefault();select(matches[0].code)}}}} onChange={e=>{setQuery(e.target.value);setGroupChoice('')}}/>{query&&<button aria-label="Limpar pesquisa da frota" onClick={()=>{setQuery('');setSearch('')}}><X size={17}/></button>}</label></div>
    {filtersOpen&&<div className="fleet-filters" id="fleet-filters"><label>Marca<select value={filters.brand} onChange={e=>updateFilter('brand',e.target.value)}><option value="all">Todas as marcas</option>{[...new Set(fleet.map(v=>v.brand).filter(Boolean))].sort().map(v=><option key={v}>{v}</option>)}</select></label><label>Modelo cadastral<select value={filters.model} onChange={e=>updateFilter('model',e.target.value)}><option value="all">Todos os modelos</option>{[...new Set(fleet.map(v=>v.model).filter(Boolean))].sort().map(v=><option key={v}>{v}</option>)}</select></label><label>Ano<select value={filters.year} onChange={e=>updateFilter('year',e.target.value)}><option value="all">Todos os anos</option>{[...new Set(fleet.map(v=>String(v.year||'Não informado')))].sort().map(v=><option key={v}>{v}</option>)}</select></label><label>Registros<select value={filters.presence} onChange={e=>updateFilter('presence',e.target.value)}><option value="all">Qualquer registro</option><option value="parts">Com peças</option><option value="services">Com serviços</option><option value="both">Peças e serviços</option></select></label><label>Último registro a partir de<input type="date" value={filters.from} onChange={e=>updateFilter('from',e.target.value)}/></label><label>Último registro até<input type="date" value={filters.to} onChange={e=>updateFilter('to',e.target.value)}/></label><label className="fleet-check"><input type="checkbox" checked={filters.repeats} disabled={!index} onChange={e=>updateFilter('repeats',e.target.checked)}/>Com repetição documental</label><button className="text-action" onClick={clear}>Limpar filtros e pesquisa</button>{filters.from&&filters.to&&filters.from>filters.to&&<p role="alert" className="fleet-error">A data inicial deve ser anterior ou igual à data final.</p>}</div>}
    <div className="fleet-map-surface">
     <div className="fleet-map-controls">
      <div className="fleet-view" role="group" aria-label="Visualização da frota">{!compact&&<button aria-pressed={view==='atlas'} onClick={()=>setView('atlas')}><LayoutGrid size={19}/>Mapa da frota</button>}<button aria-pressed={showList} onClick={()=>setView('list')}><List size={19}/>Lista</button></div>
      <p className="fleet-result-count" role="status" aria-live="polite">{summary?`${n(items.length)} de ${n(fleet.length)} veículos`:'Carregando a frota…'}{(filterCount>0||query)&&<button className="text-action" onClick={clear}>Limpar</button>}</p>
      <label className="fleet-grouping"><GitBranch size={17}/><span className="sr-only">{showList?'Ordenar veículos':'Agrupar veículos'}</span><select aria-label={showList?'Ordenar veículos':'Agrupar veículos'} value={showList?filters.sort:grouping} onChange={e=>showList?updateFilter('sort',e.target.value):(setGrouping(e.target.value as FleetGrouping),setGroupChoice(''))}>{showList?<><option value="prefix">Ordenar por prefixo</option><option value="recent">Último registro</option><option value="records">Quantidade de registros</option></>:<><option value="model">Agrupar por modelo</option><option value="brand">Agrupar por marca</option><option value="year">Agrupar por ano</option><option value="pattern">Repetição documental</option></>}</select></label>
     </div>
     {!showList&&groups.length>1&&<div className="fleet-group-choice"><label><span>Agrupamento</span><select aria-label="Escolher agrupamento da frota" value={groupChoice} onChange={e=>setGroupChoice(e.target.value)}><option value="">Todos os agrupamentos ({groups.length})</option>{groups.map(g=><option key={g.key} value={g.key}>{g.label} · {g.context} ({g.rows.length})</option>)}</select></label></div>}
     {compact&&vehicle&&<button className="fleet-secondary fleet-open-selected" onClick={()=>setDetailOpen(true)}>Abrir veículo {formatPrefix(selected)}<ChevronRight size={17}/></button>}
     {!summary?<div className="fleet-empty" role="status">Carregando veículos…</div>:!items.length?<div className="fleet-empty"><Search size={30}/><h2>Nenhum veículo localizado</h2><p>Confira o prefixo ou ajuste os filtros. A frota operacional é de 001 a 559; nem todo número tem cadastro.</p><button className="fleet-secondary" onClick={clear}>Limpar pesquisa e filtros</button></div>:showList?<FleetList key={JSON.stringify({...filters,query:search})} items={items} selected={selected} onSelect={select}/>:<GroupedFleetMap key={`${grouping}:${groupChoice}:${search}:${JSON.stringify(filters)}`} groups={shownGroups} selected={selected} onSelect={select}/>}
    </div>
    <p className="fleet-source-note"><GitBranch size={17}/><span>Agrupamento cadastral · Não indica compatibilidade de peças. Frota operacional: 55001 a 55559; carroceria e tração não definidas na fonte.</span></p>
   </div>
   {!compact&&detail}
  </div>
  {compact&&<Sheet open={detailOpen} onOpenChange={setDetailOpen}><SheetContent className="query-detail-sheet fleet-detail-sheet approved-fleet"><SheetHeader><SheetTitle>Veículo {formatPrefix(selected)}</SheetTitle><SheetDescription>Identidade, sistemas, cronologia e veículos semelhantes.</SheetDescription></SheetHeader><div className="query-detail-body">{detail}</div></SheetContent></Sheet>}
 </section>;
}

function BusOutline(){
 return <svg viewBox="0 0 100 43" className="fleet-bus-outline" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M8 7h72c4 0 6 2 7 6l4 14v7H5V11c0-2 1-4 3-4Z"/><path d="M11 11h65v13H11zm65 0 7 1 4 12H76M11 28h65M13 11v13m12-13v13m13-13v13m13-13v13m13-13v13m13 1v7M5 31H1v-7h4m83 5h4M14 34h9m49 0h7"/><circle cx="27" cy="34" r="5" fill="var(--fleet-card-bg,#062237)"/><circle cx="27" cy="34" r="2"/><circle cx="68" cy="34" r="5" fill="var(--fleet-card-bg,#062237)"/><circle cx="68" cy="34" r="2"/></svg>;
}

function GroupedFleetMap({groups,selected,onSelect}:{groups:FleetGroup[];selected:string;onSelect:(s:string)=>void}){
 const selectedGroup=groups.findIndex(g=>g.rows.some(v=>v.code===selected));
 const [page,setPage]=useState(()=>Math.max(0,Math.floor(selectedGroup/3))),[locateEpoch,setLocateEpoch]=useState(0);
 const pages=Math.ceil(groups.length/3),current=Math.min(page,Math.max(0,pages-1)),visible=groups.slice(current*3,current*3+3);
 return <div className="fleet-connected-map">
  <div className="fleet-group-columns">{visible.map(group=><FleetGroupColumn key={`${group.key}:${locateEpoch}`} group={group} selected={selected} onSelect={onSelect}/>)}</div>
  <footer className="fleet-map-pagination"><span>{groups.length===1?'1 agrupamento':`${current*3+1}–${Math.min(current*3+3,groups.length)} de ${groups.length} agrupamentos`}</span><div><button aria-label="Localizar o veículo selecionado no mapa" title="Localizar o veículo selecionado" disabled={selectedGroup<0} onClick={()=>{setPage(Math.floor(selectedGroup/3));setLocateEpoch(value=>value+1)}}><Focus size={17}/></button>{pages>1&&<><button disabled={current===0} onClick={()=>setPage(current-1)} aria-label="Agrupamentos anteriores"><ChevronLeft size={18}/></button><span>{current+1}/{pages}</span><button disabled={current===pages-1} onClick={()=>setPage(current+1)} aria-label="Próximos agrupamentos"><ChevronRight size={18}/></button></>}</div></footer>
 </div>;
}

function FleetGroupColumn({group,selected,onSelect}:{group:FleetGroup;selected:string;onSelect:(s:string)=>void}){
 const buttons=useRef(new Map<string,HTMLButtonElement>());
 const [page,setPage]=useState(()=>Math.max(0,Math.floor(group.rows.findIndex(v=>v.code===selected)/6))),[focus,setFocus]=useState('');
 const pages=Math.ceil(group.rows.length/6),current=Math.min(page,Math.max(0,pages-1)),rows=group.rows.slice(current*6,current*6+6);
 const focusCode=rows.some(v=>v.code===focus)?focus:rows.some(v=>v.code===selected)?selected:rows[0]?.code;
 function navigate(event:KeyboardEvent<HTMLButtonElement>,at:number){let next=at;if(event.key==='ArrowDown')next=Math.min(rows.length-1,at+1);else if(event.key==='ArrowUp')next=Math.max(0,at-1);else if(event.key==='Home')next=0;else if(event.key==='End')next=rows.length-1;else return;event.preventDefault();setFocus(rows[next].code);buttons.current.get(rows[next].code)?.focus()}
 return <section className="fleet-group-column" aria-label={`Veículos de ${group.label}`}>
  <header><BusFront size={23}/><div><h2>{group.label}<span> ({n(group.rows.length)})</span></h2><p>{group.context}</p></div></header>
  <div className="fleet-connected-vehicles" role="group" aria-label="Prefixos; use as setas para navegar">{rows.map((v,i)=><button key={v.code} className="fleet-map-vehicle" ref={el=>{if(el)buttons.current.set(v.code,el);else buttons.current.delete(v.code)}} aria-label={`Selecionar prefixo ${formatPrefix(v.code)}, ${v.brand||'marca não informada'}, ${v.model||'modelo não informado'}, ${v.plate||'placa não informada'}, ano ${v.year||'não informado'}`} aria-pressed={v.code===selected} tabIndex={focusCode===v.code?0:-1} onFocus={()=>setFocus(v.code)} onKeyDown={e=>navigate(e,i)} onClick={()=>onSelect(v.code)}><BusOutline/><span><strong>{formatPrefix(v.code)}</strong><small>{v.model||'Modelo não informado'}</small></span></button>)}</div>
  {pages>1&&<div className="fleet-column-pagination"><button disabled={current===0} aria-label={`Prefixos anteriores de ${group.label}`} onClick={()=>{setPage(current-1);setFocus('')}}><ChevronLeft size={16}/></button><span>{current*6+1}–{Math.min(current*6+6,group.rows.length)} de {group.rows.length}</span><button disabled={current===pages-1} aria-label={`Próximos prefixos de ${group.label}`} onClick={()=>{setPage(current+1);setFocus('')}}><ChevronRight size={16}/></button></div>}
 </section>;
}

function FleetList({items,selected,onSelect}:{items:FleetItem[];selected:string;onSelect:(s:string)=>void}){
 'use no memo';
 const parent=useRef<HTMLDivElement>(null),refs=useRef(new Map<number,HTMLButtonElement>()),pendingFocus=useRef<number|null>(null),[focused,setFocused]=useState(0);
 // TanStack owns measurement state; do not compiler-memoize this component.
 // eslint-disable-next-line react-hooks/incompatible-library
 const list=useVirtualizer({count:items.length,getScrollElement:()=>parent.current,estimateSize:()=>112,overscan:8});
 function move(event:KeyboardEvent<HTMLElement>,at:number){let next=at;if(event.key==='ArrowDown')next=Math.min(at+1,items.length-1);else if(event.key==='ArrowUp')next=Math.max(at-1,0);else if(event.key==='Home')next=0;else if(event.key==='End')next=items.length-1;else return;event.preventDefault();pendingFocus.current=next;setFocused(next);list.scrollToIndex(next,{align:'auto'});const button=refs.current.get(next);if(button){pendingFocus.current=null;button.focus({preventScroll:true})}else parent.current?.focus({preventScroll:true})}
 return <div className="fleet-list" ref={parent} role="list" tabIndex={0} onKeyDown={e=>{if(e.target===parent.current)move(e,pendingFocus.current??Math.min(focused,items.length-1))}} aria-label={`${items.length} veículos; use as setas para navegar`}><div style={{position:'relative',height:list.getTotalSize()}}>{list.getVirtualItems().map(item=>{const v=items[item.index];return <div key={v.code} ref={list.measureElement} data-index={item.index} role="listitem" aria-posinset={item.index+1} aria-setsize={items.length} style={{position:'absolute',top:item.start,paddingBottom:4,width:'100%'}}><button className="fleet-list-vehicle" ref={el=>{if(el){refs.current.set(item.index,el);if(pendingFocus.current===item.index)requestAnimationFrame(()=>{if(pendingFocus.current===item.index&&el.isConnected){pendingFocus.current=null;el.focus({preventScroll:true})}})}else refs.current.delete(item.index)}} aria-pressed={selected===v.code} tabIndex={item.index===Math.min(focused,items.length-1)?0:-1} onFocus={()=>{pendingFocus.current=null;setFocused(item.index)}} onKeyDown={e=>move(e,item.index)} onClick={()=>onSelect(v.code)}><span className="fleet-list-prefix"><BusFront size={18}/><b>{formatPrefix(v.code)}</b></span><span className="fleet-list-identity"><strong>{v.brand||'Sem marca'} · {v.model||'Modelo não informado'}</strong><small>{v.plate||'Placa não informada'} · {v.year||'Ano não informado'}</small><small>{n(v.services)} serviços · {n(v.parts)} movimentos</small></span>{selected===v.code&&<Check size={18}/>}</button></div>})}</div></div>;
}
