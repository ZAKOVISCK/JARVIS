"use client";
import {useEffect,useRef,useState} from 'react';
import {confidenceFor,snapshotChanges} from '@/lib/cognitive';
import {formatDate} from '@/lib/fleet';
import {statusLabels,type SearchSnapshot} from '@/lib/validated-search';
import {downloadData} from '@/lib/export-data';

type Event={id:string;kind:string;actor:string;created_at:string;payload:string};
const eventLabels:Record<string,string>={confirm:'Identificação confirmada',correction:'Correção proposta',report:'Anotação de relatório',comparison:'Comparação registrada'};
const dateTime=(date:string)=>new Date(date).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
function eventText(event:Event){
 try{const payload=JSON.parse(event.payload) as {note?:string;newQueryId?:string};return payload.note||('Nova consulta '+(payload.newQueryId||'não informada'))}
 catch{return 'Conteúdo da anotação indisponível. Confira o registro de auditoria.'}
}
export function HumanReview({record:r}:{record:SearchSnapshot}){
 const [events,setEvents]=useState<Event[]>([]),[mode,setMode]=useState(''),[note,setNote]=useState(''),[error,setError]=useState(''),[readError,setReadError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
 const [comparison,setComparison]=useState<{after:SearchSnapshot;changes:ReturnType<typeof snapshotChanges>}|null>(null),running=useRef(false);
 useEffect(()=>{
  const controller=new AbortController();
  void fetch('/api/query-history/'+r.id+'/events',{signal:controller.signal,cache:'no-store'}).then(async response=>{
   const d=await response.json() as {events?:Event[];error?:string};
   if(!response.ok||!Array.isArray(d.events))throw new Error(d.error||'Não foi possível carregar as decisões.');
   if(!controller.signal.aborted){setEvents(d.events);setReadError('')}
  }).catch(e=>{if(!controller.signal.aborted)setReadError(e instanceof Error?e.message:'Falha ao carregar decisões.')}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>controller.abort();
 },[r.id,refresh]);
 function refreshEvents(){setLoading(true);setReadError('');setRefresh(x=>x+1)}
 async function save(){
  if(running.current||!mode||note.trim().length<3)return;
  running.current=true;setBusy(true);setError('');
  try{
   const response=await fetch('/api/query-history/'+r.id+'/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:mode,note})}),d=await response.json() as {error?:string};
   if(!response.ok)throw new Error(d.error||'A decisão não foi registrada.');
   refreshEvents();setMode('');setNote('');
  }catch(e){setError(e instanceof Error?e.message:'Falha ao registrar.')}
  finally{running.current=false;setBusy(false)}
 }
 async function compare(){
  if(running.current)return;running.current=true;setBusy(true);setError('');
  try{
   const response=await fetch('/api/query-history/'+r.id+'/compare',{method:'POST'}),d=await response.json() as {after:SearchSnapshot;changes:ReturnType<typeof snapshotChanges>;saved?:boolean;error?:string};
   if(!response.ok||!d.saved||!d.after||!Array.isArray(d.changes))throw new Error(d.error||'A comparação não foi concluída.');
   setComparison(d);refreshEvents();
  }catch(e){setError(e instanceof Error?e.message:'Falha na comparação.')}
  finally{running.current=false;setBusy(false)}
 }
 const confidence=confidenceFor(r);
 return <section className="human-review">
  <h3>Interpretação e decisão humana</h3>
  <div className={'confidence '+confidence.tone}><strong>{confidence.label}</strong><p>{confidence.description}</p></div>
  <dl className="explainability">
   <div><dt>Fonte</dt><dd>{r.sourceMode==='sheets'?'Planilhas integradas':'CSV complementar'} · versão {r.sourceVersion.slice(0,16)}</dd></div>
   <div><dt>Divergência</dt><dd>{r.excludedCount?r.excludedCount+' registros sem elegibilidade. Confira os motivos nas evidências.':r.warnings.length?'Confira as limitações e advertências nas evidências.':'Nenhuma divergência encontrada pelas regras aplicadas.'}</dd></div>
   <div><dt>Limitação</dt><dd>Saída não comprova instalação. Não houve inspeção física do componente.</dd></div>
   <div><dt>Recomendação</dt><dd>{r.validated?'Conferir o documento e a ordem de serviço antes de decidir.':'Revisar a origem e obter um documento com confirmação de saída.'}</dd></div>
  </dl>
  {!!r.humanNotes?.length&&<section className="decision-trail"><h4>Pareceres disponíveis quando esta consulta foi realizada</h4><p>Anotações humanas não alteram automaticamente a validação documental.</p>{r.humanNotes.map(n=><article key={n.id}><b>{n.kind==='correction'?'Correção proposta':'Identificação confirmada'}</b><p>{n.note}</p><small>{dateTime(n.createdAt)} · Conta {n.actor} · Consulta {n.queryId}</small></article>)}</section>}
  <button className="text-action" disabled={loading||busy||!!readError} onClick={()=>downloadData(JSON.stringify({snapshot:r,decisions:events,comparison,exportedAt:new Date().toISOString()},null,2),'jarvis-memoria-'+r.id+'.json','application/json')}>Exportar memória e decisões carregadas</button>
  <div className="review-actions">{[['confirm','Confirmar identificação'],['correction','Registrar correção'],['report','Adicionar ao relatório']].map(([id,label])=><button key={id} className="action-secondary" disabled={busy} aria-pressed={mode===id} onClick={()=>{setMode(id);setNote('');setError('')}}>{label}</button>)}</div>
  {mode&&<form className="review-form" onSubmit={e=>{e.preventDefault();void save()}}>
   <label className="research-field"><span>Justificativa e evidência da decisão</span><textarea value={note} onChange={e=>setNote(e.target.value)} disabled={busy} minLength={3} maxLength={2000} rows={4} required/></label>
   <p>A decisão terá autoria e data. A resposta original e a fonte permanecerão intactas.</p>
   <button className="action-primary" disabled={busy||note.trim().length<3}>{busy?'Registrando…':'Registrar'}</button><button type="button" className="text-action" disabled={busy} onClick={()=>setMode('')}>Cancelar</button>
  </form>}
  <button className="change-query" disabled={busy} onClick={()=>void compare()}>{busy?'Processando…':'O que mudou desde esta consulta?'}</button>
  {comparison&&<div className="current-comparison" role="status">
   <h4>{comparison.changes.length?'A nova consulta apresenta mudanças.':'Os campos comparados permanecem iguais.'}</h4><p>Nova consulta salva sem substituir a anterior.</p>
   <p>{statusLabels[comparison.after.status]} · {comparison.after.latest?'Saída: '+formatDate(comparison.after.latest.date):comparison.after.service?'Serviço: '+formatDate(comparison.after.service.date):'Sem registro confirmado'} · KM: {comparison.after.latest?.km==null?'não informado':comparison.after.latest.km.toLocaleString('pt-BR')}</p>
   <dl className="change-fields">{comparison.changes.map(c=><div key={c.field}><dt>{c.field}</dt><dd><span>Antes: {c.before}</span><span>Agora: {c.after}</span></dd></div>)}</dl>
  </div>}
  {error&&<p role="alert" className="inline-warning">{error}</p>}
  {loading&&<p role="status">Carregando decisões de auditoria…</p>}
  {readError&&<div className="inline-warning" role="alert"><p>{readError}</p><button className="text-action" onClick={refreshEvents}>Tentar novamente</button></div>}
  {!loading&&!readError&&<div className="decision-trail"><h4>Decisões preservadas</h4>{events.length?events.map(e=><article key={e.id}><b>{eventLabels[e.kind]||e.kind}</b><p>{eventText(e)}</p><small>{dateTime(e.created_at)} · Conta {e.actor}</small></article>):<p>Nenhuma decisão registrada para esta consulta.</p>}</div>}
 </section>;
}
