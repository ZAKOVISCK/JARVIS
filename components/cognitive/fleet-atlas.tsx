'use client';
import {useEffect,useMemo,useRef,useState,useSyncExternalStore,type CSSProperties,type KeyboardEvent} from 'react';
import {BusFront,CalendarDays,Check,Disc3,Fan,Focus,Gauge,GitBranch,Layers3,List,Network,Search,Settings2,SlidersHorizontal,Wrench,X,Zap} from 'lucide-react';
import {useVirtualizer} from '@tanstack/react-virtual';
import {formatDate,formatPrefix,formatRecordNumber,type FleetItem,type Summary} from '@/lib/fleet';
import {systems,clientId,type CognitiveIndex,type SystemId,type InvestigationIntent} from '@/lib/cognitive';
import {comparableVehicles,vehicleProfileWarnings,constellationPoints,defaultFleetFilters,filterFleet,groupFleet,recentFleetEvents,type FleetFilters,type FleetGrouping} from '@/lib/fleet-atlas';
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
 const fleet=summary?.fleet||empty,vehicle=fleet.find(v=>v.code===selected)||null;
 const {data,error,retry}=useVehicle(selected);
 useEffect(()=>{const t=setTimeout(()=>setSearch(query),160);return()=>clearTimeout(t)},[query]);
 const items=useMemo(()=>filterFleet(fleet,{...filters,query:search},index),[fleet,filters,search,index]);
 const groups=useMemo(()=>groupFleet(items,grouping,index),[items,grouping,index]);
 const group=groups.find(g=>g.key===groupChoice)||{key:'__all',label:'Frota operacional',context:`${groups.length} agrupamentos cadastrais`,rows:items};
 const peers=useMemo(()=>comparableVehicles(fleet,vehicle),[fleet,vehicle]);
 const events=useMemo(()=>recentFleetEvents(data),[data]);
 const totals=useMemo(()=>items.reduce((a,v)=>({parts:a.parts+v.parts,services:a.services+v.services}),{parts:0,services:0}),[items]);
 const outsideFilters=!!vehicle&&!items.some(v=>v.code===selected);
 const filterCount=['brand','model','year','presence'].filter(k=>filters[k as keyof FleetFilters]!=='all').length+Number(filters.repeats)+Number(!!filters.from)+Number(!!filters.to);
 const showList=compact||view==='list';
 function updateFilter<K extends keyof FleetFilters>(key:K,value:FleetFilters[K]){setFilters(f=>({...f,[key]:value}));setGroupChoice('')}
 function clear(){setQuery('');setSearch('');setFilters(defaultFleetFilters);setGroupChoice('')}
 function select(code:string){onSelect(code);setDetailTab('overview');if(compact)setDetailOpen(true)}
 function investigate(){onInvestigate({id:clientId(),prefix:formatPrefix(selected),system,query:`histórico de ${systems.find(s=>s.id===system)!.query} do prefixo ${formatPrefix(selected)}`})}

 const detail=<section className="fleet-inspector" aria-label="Detalhes do veículo selecionado">
  {!vehicle?<div className="fleet-empty"><BusFront size={32}/><h2>Selecione um veículo</h2><p>A identidade e os registros serão exibidos aqui.</p></div>:<>
   <header className="fleet-identity"><span>Veículo selecionado{outsideFilters&&<small>Fora dos filtros atuais</small>}</span><div><h2>{formatPrefix(selected)}</h2><span className="fleet-plate">{vehicle.plate||'Placa não informada'}</span></div><p>{vehicle.brand||'Marca não informada'} · {vehicle.model||'Modelo não informado'}</p><span className="fleet-year">Ano {vehicle.year||'não informado'} · Estado operacional não informado</span></header>
   {vehicleProfileWarnings(vehicle).map(warning=><p key={warning} className="fleet-profile-warning" role="status">{warning}</p>)}
   <VehicleVisual vehicle={vehicle}/>
   <dl className="fleet-vehicle-signals"><div><dt><Wrench size={16}/>Serviços</dt><dd>{n(vehicle.services)}</dd></div><div><dt><Layers3 size={16}/>Movimentações</dt><dd>{n(vehicle.parts)}</dd></div><div><dt><CalendarDays size={16}/>Último registro</dt><dd>{formatDate(vehicle.last)}</dd></div></dl>
   <Tabs value={detailTab} onValueChange={setDetailTab} className="fleet-detail-tabs"><TabsList variant="line"><TabsTrigger value="overview">Sistemas</TabsTrigger><TabsTrigger value="memory">Cronologia</TabsTrigger><TabsTrigger value="peers">Semelhantes</TabsTrigger></TabsList>
    <TabsContent value="overview"><div className="fleet-systems" role="group" aria-label="Sistemas para investigar">{systems.map(s=>{const Icon=icons[s.id],stats=index?.vehicles[selected]?.systems[s.id];return <button key={s.id} aria-pressed={system===s.id} onClick={()=>setSystem(s.id)}><Icon size={20}/><span>{s.label}<small>{stats?n(stats.count):'—'} movimentos</small></span>{system===s.id&&<Check size={16}/>}</button>})}</div><p className="fleet-system-context">{systems.find(s=>s.id===system)!.label} · {index?.vehicles[selected]?.systems[system]?.last?`Último movimento em ${formatDate(index.vehicles[selected].systems[system].last)}`:'Sem data disponível'}.</p><p className="fleet-disclosure">Contagens do EXTRATO GERAL. Movimentações não comprovam instalação nem indicam o estado mecânico.</p><button className="fleet-primary" onClick={investigate}><Search size={18}/>Investigar {systems.find(s=>s.id===system)!.label.toLowerCase()}</button></TabsContent>
    <TabsContent value="memory">{error?<div className="resource-error" role="alert"><p>{error}</p><button className="fleet-secondary" onClick={retry}>Tentar novamente</button></div>:!data?<p role="status" className="fleet-loading">Carregando cronologia do {formatPrefix(selected)}…</p>:!events.length?<p className="fleet-empty">Nenhum registro de manutenção para este prefixo.</p>:<ol className="fleet-timeline">{events.map(e=><li key={e.id}><time dateTime={e.date}>{formatDate(e.date)}</time><small>{e.kind}</small><strong>{e.title}</strong><span>{e.source} · Linha {e.row}<br/>{e.kind==='Serviço registrado'?'Nº Ficha':'Lançamento'}: {e.reference?formatRecordNumber(e.reference):'Não informado'}{e.workOrder&&` · O.S.: ${formatRecordNumber(e.workOrder)}`}{e.km!==null&&` · KM: ${n(e.km)}`}</span></li>)}</ol>}<button className="fleet-secondary" onClick={()=>onHistory(selected)}>Histórico completo do veículo</button></TabsContent>
    <TabsContent value="peers"><div className="fleet-peer-intro"><GitBranch size={20}/><p><strong>{n(peers.length)} veículos</strong> com a mesma marca e modelo cadastral, ordenados pela proximidade do ano.</p></div><div className="fleet-peers">{peers.slice(0,6).map(v=><button key={v.code} onClick={()=>select(v.code)}><b>{formatPrefix(v.code)}</b><span>{v.year||'Ano não informado'} · {v.plate||'Sem placa'}</span></button>)}</div>{!peers.length&&<p>Não há outro veículo com essa combinação cadastral.</p>}<p className="fleet-disclosure">Similaridade cadastral não comprova compatibilidade de peças ou manutenção semelhante.</p>{!!peers.length&&<button className="fleet-secondary" onClick={()=>{setQuery('');setSearch('');setFilters({...defaultFleetFilters,brand:vehicle.brand!,model:vehicle.model!});setGroupChoice('');setDetailOpen(false)}}>Localizar todos os semelhantes</button>}</TabsContent>
   </Tabs>
  </>}
 </section>;

 return <section className="fleet-atlas" aria-labelledby="fleet-title">
  <header className="fleet-heading"><div><span className="eyebrow">Atlas da frota</span><h1 id="fleet-title">Cada veículo, um contexto.</h1></div><div className="fleet-signals" aria-label="Totais nos filtros atuais"><span><BusFront size={18}/><b>{summary?n(items.length):'—'}</b> prefixos</span><span><Wrench size={18}/><b>{summary?n(totals.services):'—'}</b> serviços</span><span><Layers3 size={18}/><b>{summary?n(totals.parts):'—'}</b> movimentos</span></div></header>
  <div className="fleet-toolbar"><label className="fleet-search"><Search size={20}/><input type="search" aria-label="Pesquisar na frota" placeholder="Prefixo, placa, marca ou modelo" value={query} onKeyDown={e=>{if(e.key==='Enter'){const matches=filterFleet(fleet,{...filters,query},index);if(matches.length===1){e.preventDefault();select(matches[0].code)}}}} onChange={e=>{setQuery(e.target.value);setGroupChoice('')}}/>{query&&<button aria-label="Limpar pesquisa da frota" onClick={()=>{setQuery('');setSearch('')}}><X size={17}/></button>}</label><button className="fleet-secondary" aria-expanded={filtersOpen} aria-controls="fleet-filters" onClick={()=>setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={18}/>Filtros{filterCount>0&&<span className="fleet-filter-count">{filterCount}</span>}</button>{!compact&&<div className="fleet-view" role="group" aria-label="Visualização da frota"><button aria-pressed={view==='atlas'} onClick={()=>setView('atlas')}><Network size={18}/>Atlas</button><button aria-pressed={view==='list'} onClick={()=>setView('list')}><List size={18}/>Lista</button></div>}</div>
  {filtersOpen&&<div className="fleet-filters" id="fleet-filters"><label>Marca<select value={filters.brand} onChange={e=>updateFilter('brand',e.target.value)}><option value="all">Todas as marcas</option>{[...new Set(fleet.map(v=>v.brand).filter(Boolean))].sort().map(v=><option key={v}>{v}</option>)}</select></label><label>Modelo cadastral<select value={filters.model} onChange={e=>updateFilter('model',e.target.value)}><option value="all">Todos os modelos</option>{[...new Set(fleet.map(v=>v.model).filter(Boolean))].sort().map(v=><option key={v}>{v}</option>)}</select></label><label>Ano<select value={filters.year} onChange={e=>updateFilter('year',e.target.value)}><option value="all">Todos os anos</option>{[...new Set(fleet.map(v=>String(v.year||'Não informado')))].sort().map(v=><option key={v}>{v}</option>)}</select></label><label>Registros<select value={filters.presence} onChange={e=>updateFilter('presence',e.target.value)}><option value="all">Qualquer registro</option><option value="parts">Com peças</option><option value="services">Com serviços</option><option value="both">Peças e serviços</option></select></label><label>Último registro a partir de<input type="date" value={filters.from} onChange={e=>updateFilter('from',e.target.value)}/></label><label>Último registro até<input type="date" value={filters.to} onChange={e=>updateFilter('to',e.target.value)}/></label><label className="fleet-check"><input type="checkbox" checked={filters.repeats} disabled={!index} onChange={e=>updateFilter('repeats',e.target.checked)}/>Com repetição documental</label><button className="text-action" onClick={clear}>Limpar filtros e pesquisa</button>{filters.from&&filters.to&&filters.from>filters.to&&<p role="alert" className="fleet-error">A data inicial deve ser anterior ou igual à data final.</p>}</div>}
  <p className="fleet-result-count" role="status" aria-live="polite">{summary?`${n(items.length)} de ${n(fleet.length)} veículos · ${n(groups.length)} agrupamentos`:'Carregando a frota…'}{(filterCount>0||query)&&<button className="text-action" onClick={clear}>Limpar</button>}</p>
  <div className={`fleet-layout ${showList?'is-list':''}`}>
   <div className="fleet-explorer">
    <div className="fleet-explorer-heading"><label>{showList?'Ordenar por':'Agrupar por'}<select aria-label={showList?'Ordenar veículos':'Agrupar veículos'} value={showList?filters.sort:grouping} onChange={e=>showList?updateFilter('sort',e.target.value):(setGrouping(e.target.value as FleetGrouping),setGroupChoice(''))}>{showList?<><option value="prefix">Prefixo</option><option value="recent">Último registro</option><option value="records">Quantidade de registros</option></>:<><option value="model">Modelo cadastral</option><option value="brand">Marca</option><option value="year">Ano</option><option value="pattern">Repetição documental</option></>}</select></label>{compact&&vehicle&&<button className="fleet-secondary" onClick={()=>setDetailOpen(true)}>Abrir {formatPrefix(selected)}</button>}</div>
    {!summary?<div className="fleet-empty" role="status">Carregando veículos…</div>:!items.length?<div className="fleet-empty"><Search size={30}/><h2>Nenhum veículo localizado</h2><p>Confira o prefixo ou ajuste os filtros. A frota operacional é de 001 a 559; nem todo número tem cadastro.</p><button className="fleet-secondary" onClick={clear}>Limpar pesquisa e filtros</button></div>:showList?<FleetList key={JSON.stringify({...filters,query:search})} items={items} selected={selected} onSelect={select}/>:<div className="fleet-spatial"><nav className="fleet-groups" aria-label="Agrupamentos da frota"><button aria-pressed={group.key==='__all'} onClick={()=>setGroupChoice('')} style={{'--group-tone':'#62d5ed'} as CSSProperties}><Network size={17}/><span><strong>Todos os veículos</strong><small>{groups.length} agrupamentos</small></span><b>{items.length}</b></button>{groups.map((g,i)=><button key={g.key} aria-pressed={group?.key===g.key} onClick={()=>setGroupChoice(g.key)} style={{'--group-tone':i%3===0?'#62d5ed':i%3===1?'#8bd5b6':'#b2a7dc'} as CSSProperties}><span className="fleet-group-dot"/><span><strong>{g.label}</strong><small>{g.context}</small></span><b>{g.rows.length}</b></button>)}</nav>{group&&<Constellation key={`${group.key}:${search}:${filters.sort}`} group={group} selected={selected} onSelect={select}/>}</div>}
    <p className="fleet-source-note">Frota operacional · 55001 a 55559. Agrupamentos cadastrais, não geográficos. Tração, carroceria e estado operacional não estão definidos na fonte.</p>
   </div>
   {!compact&&detail}
  </div>
  {compact&&<Sheet open={detailOpen} onOpenChange={setDetailOpen}><SheetContent className="query-detail-sheet fleet-detail-sheet"><SheetHeader><SheetTitle>Veículo {formatPrefix(selected)}</SheetTitle><SheetDescription>Identidade, sistemas, cronologia e veículos semelhantes.</SheetDescription></SheetHeader><div className="query-detail-body">{detail}</div></SheetContent></Sheet>}
 </section>;
}

function Constellation({group,selected,onSelect}:{group:ReturnType<typeof groupFleet>[number];selected:string;onSelect:(s:string)=>void}){
 const container=useRef<HTMLDivElement>(null),buttons=useRef(new Map<string,HTMLButtonElement>());
 const [width,setWidth]=useState(560),[anchor,setAnchor]=useState(()=>Math.max(0,group.rows.findIndex(v=>v.code===selected))),[focus,setFocus]=useState('');
 useEffect(()=>{if(!container.current)return;const observer=new ResizeObserver(([entry])=>setWidth(entry.contentRect.width));observer.observe(container.current);return()=>observer.disconnect()},[]);
 const pageSize=Math.max(8,Math.min(48,Math.floor(Math.pow((Math.min(width,480)/2-42)/35,2))));
 const pages=Math.ceil(group.rows.length/pageSize),current=Math.max(0,Math.min(Math.floor(anchor/pageSize),pages-1)),rows=group.rows.slice(current*pageSize,(current+1)*pageSize);
 const points=constellationPoints(rows.length,width),active=rows.findIndex(v=>v.code===selected),focusCode=rows.some(v=>v.code===focus)?focus:active>=0?selected:rows[0]?.code;
 function locate(){const at=group.rows.findIndex(v=>v.code===selected);if(at>=0)setAnchor(at)}
 function navigate(event:KeyboardEvent<HTMLButtonElement>,at:number){
  const direction:{[key:string]:[number,number]}={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  let next=-1;
  if(event.key==='Home')next=0;else if(event.key==='End')next=rows.length-1;else if(direction[event.key]){
   const [dx,dy]=direction[event.key],origin=points[at];let score=Infinity;
   points.forEach((p,i)=>{if(i===at)return;const x=p.x-origin.x,y=p.y-origin.y,forward=x*dx+y*dy;if(forward<=0)return;const value=Math.hypot(x,y)+Math.abs(x*dy-y*dx)*1.8;if(value<score){score=value;next=i}});
  }else return;
  event.preventDefault();if(next>=0){setFocus(rows[next].code);buttons.current.get(rows[next].code)?.focus()}
 }
 return <section className="fleet-constellation" aria-label={`Veículos de ${group.label}`}>
  <header><div><small>{group.context}</small><h2>{group.label}</h2><span>{n(group.rows.length)} veículos neste agrupamento</span></div><button className="fleet-locate" title="Localizar o veículo selecionado neste grupo" aria-label="Localizar o selecionado no Atlas" disabled={!group.rows.some(v=>v.code===selected)} onClick={locate}><Focus size={19}/></button></header>
  <div className="fleet-node-field" ref={container} role="group" aria-label="Prefixos; use Tab para entrar e as setas para navegar">
   <svg width="100%" height="480" aria-hidden="true"><g className="fleet-grid-lines">{Array.from({length:5},(_,i)=><ellipse key={i} cx={width/2} cy="240" rx={(i+1)*40} ry={(i+1)*40}/>)}</g><g className="fleet-node-links">{points.map((p,i)=>i>0?<path key={i} d={`M${p.x} ${p.y} L${points[Math.floor((i-1)/2)].x} ${points[Math.floor((i-1)/2)].y}`}/>:null)}</g>{active>=0&&<circle className="fleet-selected-halo" cx={points[active].x} cy={points[active].y} r="34"/>}</svg>
   {rows.map((v,i)=><button className="fleet-node" key={v.code} ref={el=>{if(el)buttons.current.set(v.code,el);else buttons.current.delete(v.code)}} style={{left:points[i].x,top:points[i].y}} aria-label={`Selecionar prefixo ${formatPrefix(v.code)}, ${v.plate||'placa não informada'}, ano ${v.year||'não informado'}`} aria-pressed={selected===v.code} tabIndex={focusCode===v.code?0:-1} onFocus={()=>setFocus(v.code)} onKeyDown={e=>navigate(e,i)} onClick={()=>onSelect(v.code)}><span className="fleet-node-marker"/><b>{formatPrefix(v.code)}</b></button>)}
  </div>
  <footer><span>{current*pageSize+1}–{Math.min((current+1)*pageSize,group.rows.length)} de {group.rows.length} prefixos</span><div><button disabled={current===0} onClick={()=>{setAnchor((current-1)*pageSize);setFocus('')}}>Anterior</button><span>{current+1}/{pages}</span><button disabled={current===pages-1} onClick={()=>{setAnchor((current+1)*pageSize);setFocus('')}}>Próximos</button></div></footer>
  <p>Selecione um prefixo para abrir seu contexto. As conexões organizam a navegação; não representam compatibilidade técnica.</p>
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
