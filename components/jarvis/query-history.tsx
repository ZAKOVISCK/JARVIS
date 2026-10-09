"use client";
import {useEffect,useRef,useState} from "react";
import {ArrowLeftRight,ArrowRight,ChevronLeft,ChevronRight,Download,History,LoaderCircle,Search,TriangleAlert,X} from "lucide-react";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle} from "@/components/ui/sheet";
import {Choice,QueryDetails,ResultTable,ValidationBadge,recordExportHeader,recordExportRow} from "./research";
import {statusLabels,type SearchSnapshot} from "@/lib/validated-search";
import {formatDate} from "@/lib/fleet";
import {TemporalMemory} from "@/components/cognitive/temporal-memory";
import {snapshotChanges} from '@/lib/cognitive';
import {csvCell,downloadData} from '@/lib/export-data';
const dateTime=(s:string)=>new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"}).format(new Date(s));
const empty={q:"",prefix:"",from:"",to:"",status:"all",source:"all",decision:"all"};
type JournalResponse={records:SearchSnapshot[];total:number;counts:Record<string,number>;watermark?:number;asOf?:string;nextCursor?:string|null;error?:string};
export function QueryHistory({visible,onMaintenance,onSearch,onReopen}:{visible:boolean;onMaintenance:(s:string)=>void;onSearch:()=>void;onReopen:(r:SearchSnapshot)=>void}){
 const [view,setView]=useState("timeline");
 const [draft,setDraft]=useState(empty),[filters,setFilters]=useState(empty),[page,setPage]=useState(1),[refresh,setRefresh]=useState(0);
 const [data,setData]=useState<JournalResponse>({records:[],total:0,counts:{}}),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [detail,setDetail]=useState<SearchSnapshot|null>(null),[selected,setSelected]=useState<SearchSnapshot[]>([]),[compare,setCompare]=useState(false);
 const [exportProgress,setExportProgress]=useState<{done:number;total:number}|null>(null),[exportNotice,setExportNotice]=useState(''),[exportError,setExportError]=useState('');
 const exportAbort=useRef<AbortController|null>(null),pageSession=useRef<{watermark:number;asOf:string}|null>(null);
 useEffect(()=>()=>{exportAbort.current?.abort()},[]);
 useEffect(()=>{
  if(!visible)return;
  const controller=new AbortController(),timer=setTimeout(()=>{setBusy(true);setError('')},0),p=new URLSearchParams({...filters,page:String(page)});
  if(page>1&&pageSession.current){p.set('watermark',String(pageSession.current.watermark));p.set('asOf',pageSession.current.asOf)}
  void fetch('/api/query-history?'+p,{cache:'no-store',signal:controller.signal}).then(async response=>{
   const next=await response.json() as JournalResponse;if(!response.ok)throw new Error(next.error||'Não foi possível carregar o histórico.');
   if(controller.signal.aborted)return;
   if(page===1&&typeof next.watermark==='number'&&next.asOf)pageSession.current={watermark:next.watermark,asOf:next.asOf};
   setData(next);
  }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Falha ao carregar o histórico.')}).finally(()=>{clearTimeout(timer);if(!controller.signal.aborted)setBusy(false)});
  return()=>{clearTimeout(timer);controller.abort()};
 },[visible,filters,page,refresh]);
 function toggle(r:SearchSnapshot){setSelected(prev=>prev.some(v=>v.id===r.id)?prev.filter(v=>v.id!==r.id):prev.length===2?[prev[1],r]:[...prev,r]);}
 async function exportSelection(){
  if(exportAbort.current)return;
  const controller=new AbortController();exportAbort.current=controller;setExportProgress({done:0,total:data.total});setExportError('');setExportNotice('');
  const p=new URLSearchParams({...filters,page:'1'}),chunks:BlobPart[]=['\uFEFF'+recordExportHeader.map(csvCell).join(';')];let done=0,expected:number|undefined;const seenCursors=new Set<string>();
  try{
   while(true){
    const response=await fetch(`/api/query-history?${p}`,{cache:'no-store',signal:controller.signal}),next=await response.json() as JournalResponse;
    if(!response.ok)throw new Error(next.error||'Falha ao exportar a seleção.');
    if(!Array.isArray(next.records)||typeof next.watermark!=='number'||!next.asOf||!Number.isSafeInteger(next.total))throw new Error('Resposta de exportação incompleta. Nenhum arquivo foi gerado.');
    expected??=next.total;if(next.total!==expected)throw new Error('A seleção mudou durante a leitura. Atualize o histórico e tente novamente.');
    for(const record of next.records)chunks.push('\r\n'+recordExportRow(record).map(csvCell).join(';'));
    done+=next.records.length;setExportProgress({done,total:expected});
    if(!next.nextCursor)break;
    if(!next.records.length||seenCursors.has(next.nextCursor))throw new Error('A paginação não avançou. Nenhum arquivo foi gerado.');
    seenCursors.add(next.nextCursor);p.set('watermark',String(next.watermark));p.set('asOf',next.asOf);p.set('cursor',next.nextCursor);
   }
   if(controller.signal.aborted)throw new DOMException('Exportação cancelada','AbortError');
   if(done!==expected)throw new Error('A exportação ficou incompleta. Nenhum arquivo foi gerado.');
   downloadData(chunks,'jarvis-memoria-consultas.csv','text/csv;charset=utf-8');setExportNotice(`${done.toLocaleString('pt-BR')} consultas exportadas. A seleção inclui todas as páginas e preserva o recorte do início da exportação.`);
  }catch(e){if(controller.signal.aborted)setExportNotice('Exportação cancelada. Nenhum arquivo parcial foi gerado.');else setExportError(e instanceof Error?e.message:'Não foi possível exportar.');}
  finally{exportAbort.current=null;setExportProgress(null)}
 }
 const compared=[...selected].sort((a,b)=>a.queriedAt.localeCompare(b.queriedAt));
 const changes=compared.length===2?snapshotChanges(compared[0],compared[1]):[];
 const pages=Math.max(1,Math.ceil(data.total/30));const filtered=Object.entries(filters).some(([key,v])=>v&&v!==(empty as Record<string,string>)[key]);
 return <section className="query-journal">
  <div className="journal-heading"><div><span className="eyebrow">MEMÓRIA DAS CONSULTAS</span><h2>Cada pesquisa, preservada.</h2><p>Veja o resultado encontrado naquele momento, mesmo que a base tenha mudado depois.</p></div><button className="text-action" onClick={onSearch}>Nova pesquisa<ArrowRight/></button></div>
  <form className="journal-filters surface" onSubmit={e=>{e.preventDefault();setPage(1);setFilters({...draft})}}>
   <label className="research-field journal-quick"><span>Busca no histórico</span><div className="input-with-icon"><Search/><Input placeholder="Peça, veículo ou lançamento" aria-label="Busca no histórico de consultas" maxLength={180} value={draft.q} onChange={e=>setDraft({...draft,q:e.target.value})}/></div></label>
   <label className="research-field"><span>Prefixo</span><Input aria-label="Filtrar consultas por prefixo" placeholder="Todos" maxLength={5} inputMode="numeric" value={draft.prefix} onChange={e=>setDraft({...draft,prefix:e.target.value})}/></label>
   <Choice label="Status da consulta" value={draft.status} onChange={status=>setDraft({...draft,status})} options={[["all","Todos os status"],["confirmed","Com saída validada"],["unconfirmed_all","Sem saída validada"],...Object.entries(statusLabels)]}/>
   <details className="journal-refinement"><summary>Período, origem e decisões{[draft.from,draft.to,draft.source!=="all",draft.decision!=="all"].filter(Boolean).length>0&&<span> · {[draft.from,draft.to,draft.source!=="all",draft.decision!=="all"].filter(Boolean).length} critérios</span>}</summary><div className="journal-additional-filters"><label className="research-field"><span>Pesquisado desde</span><Input type="date" aria-label="Data inicial das consultas" value={draft.from} onChange={e=>setDraft({...draft,from:e.target.value})}/></label>
   <label className="research-field"><span>Pesquisado até</span><Input type="date" aria-label="Data final das consultas" min={draft.from||undefined} value={draft.to} onChange={e=>setDraft({...draft,to:e.target.value})}/></label>
   <Choice label="Decisões" value={draft.decision} onChange={decision=>setDraft({...draft,decision})} options={[["all","Todas"],["confirm","Confirmadas"],["correction","Com correção"],["report","No relatório"]]}/>
   <Choice label="Origem" value={draft.source} onChange={source=>setDraft({...draft,source})} options={[["all","Todas as fontes"],["sheets","Planilhas integradas"],["csv","Meu CSV"]]}/></div></details>
   <div className="journal-filter-actions"><Button type="submit" className="primary-action" disabled={busy||!!exportProgress}><Search/>Aplicar filtros</Button>{filtered&&<button type="button" className="text-action" onClick={()=>{setDraft(empty);setFilters(empty);setPage(1)}}>Limpar<X/></button>}</div>
  </form>
  <div className="journal-toolbar"><span aria-live="polite">{busy?"Carregando consultas…":`${data.total.toLocaleString("pt-BR")} consultas${filtered?" nesta seleção":" registradas"}`}</span><div><button className="text-action" onClick={()=>{pageSession.current=null;setPage(1);setRefresh(v=>v+1)}} disabled={busy}><History/>Atualizar</button><button className="text-action" onClick={()=>void exportSelection()} disabled={!data.total||busy||!!error||!!exportProgress}><Download/>Exportar seleção completa</button></div></div>
  {exportProgress&&<div className="export-progress" role="status"><LoaderCircle className="spin"/><span>Exportando {exportProgress.done.toLocaleString('pt-BR')} de {exportProgress.total.toLocaleString('pt-BR')} consultas…</span><button className="text-action" onClick={()=>exportAbort.current?.abort()}>Cancelar exportação</button></div>}
  {exportNotice&&<p className="saved-note" role="status">{exportNotice}</p>}{exportError&&<p className="inline-warning" role="alert">{exportError}</p>}
  {selected.length>0&&<div className="comparison-bar"><span><ArrowLeftRight/>{selected.length} de 2 consultas selecionadas para comparar</span><div><Button disabled={selected.length!==2} onClick={()=>setCompare(true)}>Comparar</Button><button aria-label="Limpar comparação" onClick={()=>setSelected([])}><X/></button></div></div>}
  {error?<div className="research-error" role="alert"><TriangleAlert/><div><strong>O histórico está temporariamente indisponível.</strong><p>{error}</p><Button onClick={()=>setRefresh(v=>v+1)}>Tentar novamente</Button></div></div>:busy?<div className="journal-loading" role="status"><LoaderCircle className="spin"/>Carregando registros preservados…</div>:data.records.length?<><div className="view-switch"><button aria-pressed={view==='timeline'} onClick={()=>setView('timeline')}>Linha temporal</button><button aria-pressed={view==='list'} onClick={()=>setView('list')}>Lista</button></div>{view==='timeline'?<TemporalMemory records={data.records} onOpen={setDetail} onSelect={toggle} selected={selected.map(r=>r.id)}/>:<ResultTable records={data.records} onOpen={setDetail} history onSelect={toggle} selected={selected.map(s=>s.id)}/>}<div className="journal-pagination"><span>Página {page} de {pages}</span><div><Button variant="ghost" disabled={page===1} onClick={()=>setPage(p=>p-1)} aria-label="Página anterior de consultas"><ChevronLeft/></Button><Button variant="ghost" disabled={page>=pages} onClick={()=>setPage(p=>p+1)} aria-label="Próxima página de consultas"><ChevronRight/></Button></div></div><p className="saved-note">Abra os detalhes para conferir a origem. Selecione duas consultas para comparar os resultados preservados.</p></>:<div className="research-empty"><div className="empty-emblem"><History/></div><h3>{filtered?"Nenhuma consulta nesta seleção.":"Sua próxima pesquisa já ficará aqui."}</h3><p>{filtered?"Ajuste o período, o prefixo ou o status para encontrar outros registros.":"As pesquisas realizadas a partir desta atualização são registradas automaticamente. O histórico de manutenção dos veículos continua na aba ao lado."}</p><Button onClick={filtered?()=>{setDraft(empty);setFilters(empty);setPage(1)}:onSearch}>{filtered?"Limpar filtros":"Fazer uma pesquisa"}<ArrowRight/></Button></div>}
  <QueryDetails onReopen={onReopen} record={detail} onClose={()=>setDetail(null)} onMaintenance={onMaintenance}/>
  <Sheet open={compare} onOpenChange={setCompare}><SheetContent className="query-detail-sheet comparison-sheet"><SheetHeader><SheetTitle>Comparar consultas</SheetTitle><SheetDescription>Resultados preservados em cada pesquisa. Nenhum dado foi consultado novamente.</SheetDescription></SheetHeader>{selected.length===2&&<div className="query-detail-body"><div className="comparison-intro">{selected[0].prefix===selected[1].prefix&&selected[0].resolvedPart===selected[1].resolvedPart?<p>{!changes.length?"Os campos de resultado, critérios e versões destas consultas permanecem iguais.":"Há mudanças nos resultados, critérios ou versões destas consultas. Confira os campos abaixo."}</p>:<p>Você selecionou peças ou veículos diferentes. Confira os identificadores antes de comparar.</p>}</div>{!!changes.length&&<section className="comparison-changes"><h3>Campos alterados</h3><p>Da consulta mais antiga para a mais recente.</p>{changes.map(c=><div key={c.field}><strong>{c.field}</strong><span>{c.before}</span><span>{c.after}</span></div>)}</section>}<div className="comparison-grid">{compared.map(r=><article key={r.id}><span className="eyebrow">CONSULTA REALIZADA</span><h3>{dateTime(r.queriedAt)}</h3><dl><div><dt>Prefixo</dt><dd>{r.prefix}</dd></div><div><dt>Peça</dt><dd>{r.resolvedPart}</dd></div><div><dt>Última saída validada</dt><dd>{r.latest?formatDate(r.latest.date):"Não localizada"}</dd></div><div><dt>KM</dt><dd>{r.latest?.km==null?"Não informado":r.latest.km.toLocaleString("pt-BR")+" km"}</dd></div><div><dt>Lançamento</dt><dd>{r.latest?.document||"Não informado"}</dd></div><div><dt>Fonte</dt><dd>{r.sourceMode==="sheets"?"Planilhas integradas":"Meu CSV"}</dd></div><div><dt>Antiguidade após</dt><dd>{r.recentDays} dias</dd></div></dl><ValidationBadge status={r.status}/><p>{r.explanation}</p><button className="text-action" onClick={()=>{setCompare(false);setDetail(r)}}>Detalhes<ArrowRight/></button></article>)}</div></div>}</SheetContent></Sheet>
 </section>
}
