'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {FileUp,LoaderCircle,ShieldCheck} from 'lucide-react';
import {inspectImportCsv,parseImportCsv,type ColumnMapping} from '@/lib/import-pipeline';
import {csvDocument,downloadData} from '@/lib/export-data';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogAction,AlertDialogCancel} from '@/components/ui/alert-dialog';
import {AdminAuditPanel,type AdminAudit} from './admin-audit';

type Job={id:string;fileName:string;fileHash?:string;status:string;totalRows:number;acceptedRows:number;duplicateRows:number;quarantineRows:number;createdAt:string};
type Row={rowNumber:number;status:string;reason:string;payload:Record<string,string|number|null>};
type Preview={events?:{kind:string;actor:string;created_at:string}[];job:Job;rows:Row[];report:{movements:Record<string,number>;identifiers:{provided:number;generated:number}}};
type Operation='read'|'open'|'prepare'|'integrate'|'cancel'|'rollback'|null;
const labels:Record<string,string>={prefix:'Prefixo *',part:'Peça ou código *',date:'Data *',source:'Origem *',sourceRecordId:'ID original',movementType:'Natureza do movimento',quantity:'Quantidade',km:'Quilometragem',workOrder:'O.S.',mechanic:'Responsável',time:'Horário',notes:'Observações'};
const statuses:Record<string,string>={review:'Em revisão',integrated:'Publicada',cancelled:'Cancelada',rolled_back:'Revertida'};
const rowLabels:Record<string,string>={accepted:'Estruturalmente válida',duplicate:'Duplicada',quarantine:'Quarentena',integrated:'Publicada',rolled_back:'Revertida'};
const natures:Record<string,string>={issue:'Saída explícita',return:'Devolução',reversal:'Estorno',entry:'Entrada',adjustment:'Ajuste',unknown:'Não classificado'};
const operationLabels:Record<Exclude<Operation,null>,string>={read:'Lendo o arquivo…',open:'Carregando conferência…',prepare:'Conciliando no servidor…',integrate:'Publicando registros aprovados…',cancel:'Cancelando importação…',rollback:'Revertendo a importação…'};
const message=(e:unknown,fallback:string)=>e instanceof Error?e.message:fallback;
export function Integration(){
 const [file,setFile]=useState<File|null>(null),[content,setContent]=useState(''),[inspection,setInspection]=useState<ReturnType<typeof inspectImportCsv>|null>(null),[mapping,setMapping]=useState<ColumnMapping>({});
 const [preview,setPreview]=useState<Preview|null>(null),[pendingJob,setPendingJob]=useState<Job|null>(null),[previewStale,setPreviewStale]=useState(false);
 const [jobs,setJobs]=useState<Job[]>([]),[jobsLoading,setJobsLoading]=useState(true),[jobsError,setJobsError]=useState(''),[audit,setAudit]=useState<AdminAudit|null>(null),[auditError,setAuditError]=useState('');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[operation,setOperation]=useState<Operation>(null),[approved,setApproved]=useState(false),[filter,setFilter]=useState('all'),[page,setPage]=useState(1),[rollbackOpen,setRollbackOpen]=useState(false);
 const input=useRef<HTMLInputElement>(null),active=useRef<Operation>(null),mounted=useRef(true),reader=useRef<AbortController|null>(null),jobsReader=useRef<AbortController|null>(null);
 const busy=operation!==null;
 const loadJobs=useCallback(async()=>{
  if(!mounted.current)return;
  jobsReader.current?.abort();const controller=new AbortController();jobsReader.current=controller;setJobsLoading(true);setJobsError('');
  try{
   const response=await fetch('/api/imports',{cache:'no-store',signal:controller.signal}),data=await response.json() as {jobs?:Job[];error?:string};
   if(!response.ok||!Array.isArray(data.jobs))throw new Error(data.error||'Histórico de importações indisponível.');
   if(mounted.current&&!controller.signal.aborted)setJobs(data.jobs);
  }catch(e){if(mounted.current&&!controller.signal.aborted)setJobsError(message(e,'Histórico indisponível.'))}
  finally{if(mounted.current&&!controller.signal.aborted)setJobsLoading(false)}
 },[]);
 useEffect(()=>{
  mounted.current=true;const controller=new AbortController(),timer=setTimeout(()=>void loadJobs(),0);
  void fetch('/data/admin-audit.json',{signal:controller.signal}).then(async response=>{
   if(!response.ok)throw new Error('O relatório da base principal está indisponível.');
   const data=await response.json() as AdminAudit;if(!controller.signal.aborted)setAudit(data);
  }).catch(e=>{if(!controller.signal.aborted)setAuditError(message(e,'Relatório indisponível.'))});
  return()=>{mounted.current=false;clearTimeout(timer);controller.abort();reader.current?.abort();jobsReader.current?.abort()};
 },[loadJobs]);
 function begin(kind:Exclude<Operation,null>){if(active.current)return false;active.current=kind;setOperation(kind);setError('');return true}
 function finish(){active.current=null;if(mounted.current)setOperation(null)}
 function reset(){
  reader.current?.abort();setFile(null);setContent('');setInspection(null);setMapping({});setPreview(null);setPendingJob(null);setPreviewStale(false);setApproved(false);setFilter('all');setPage(1);setError('');setNotice('');
 }
 async function readPreview(job:Job){
  reader.current?.abort();const controller=new AbortController();reader.current=controller;
  const response=await fetch('/api/imports/'+job.id,{cache:'no-store',signal:controller.signal}),data=await response.json() as Preview&{error?:string};
  if(!response.ok||!data.job||!Array.isArray(data.rows)||!data.report)throw new Error(data.error||'Não foi possível carregar a conferência.');
  if(!mounted.current||controller.signal.aborted)return;
  setPreview(data);setPreviewStale(false);setPendingJob(null);setApproved(false);setPage(1);setFilter('all');setFile(null);setContent('');setInspection(null);setMapping({});
 }
 async function select(file:File){
  if(!begin('read'))return;reset();
  try{
   if(!file.name.toLowerCase().endsWith('.csv')||file.size>4*1024*1024)throw new Error('Use CSV de até 4 MB, com até 1.000 linhas.');
   if(file.name.trim().length>180)throw new Error('O nome do arquivo excede 180 caracteres. Renomeie o arquivo antes de importar.');
   const text=await file.text(),parsed=inspectImportCsv(text);
   if(mounted.current){setFile(file);setContent(text);setInspection(parsed);setMapping(parsed.mapping)}
  }catch(e){if(mounted.current)setError(message(e,'Arquivo inválido.'))}finally{finish()}
 }
 async function open(job:Job){if(!begin('open'))return;try{await readPreview(job)}catch(e){if(mounted.current)setError(message(e,'Conferência indisponível.'))}finally{finish()}}
 async function stage(){
  if(!file||pendingJob||!begin('prepare'))return;
  try{
   parseImportCsv(content,mapping);
   const response=await fetch('/api/imports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fileName:file.name,content,mapping})}),data=await response.json() as {job?:Job;error?:string};
   if(!response.ok||!data.job)throw new Error(data.error||'A preparação não foi concluída.');
   if(mounted.current){setPendingJob(data.job);setNotice('Preparação salva no servidor. Nenhuma linha publicada.')}
   await readPreview(data.job);
  }catch(e){if(mounted.current)setError(message(e,'Falha na preparação.'))}finally{await loadJobs();finish()}
 }
 async function action(kind:'integrate'|'cancel'|'rollback'){
  if(!preview||previewStale||(kind==='integrate'&&!approved)||!begin(kind))return;
  const job=preview.job;
  try{
   const response=await fetch('/api/imports/'+job.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:kind})}),data=await response.json() as {count:number;status:string;error?:string};
   if(!response.ok)throw new Error(data.error||'A operação não foi confirmada. Atualize a conferência antes de tentar novamente.');
   if(mounted.current){
    setApproved(false);setRollbackOpen(false);setPreviewStale(true);setPreview(p=>p?{...p,job:{...p.job,status:data.status}}:p);
    setNotice(kind==='integrate'?data.count+' registros publicados.':kind==='cancel'?'Importação cancelada. Nenhuma linha publicada.':'Reversão concluída. Consultas anteriores preservadas.');
   }
   await readPreview(job);
  }catch(e){if(mounted.current){setPreviewStale(true);setApproved(false);setRollbackOpen(false);setError(message(e,'Operação não confirmada. Atualize a conferência antes de repetir.'))}}
  finally{await loadJobs();finish()}
 }
 function download(){
  if(!preview||previewStale)return;
  const lines=[['Arquivo','SHA256','Linha','ID origem','Prefixo','Peça','Data','Horário','KM','O.S.','Responsável','Natureza','Evidência','Quantidade','Estado','Motivo'],...preview.rows.map(r=>[preview.job.fileName,preview.job.fileHash,r.rowNumber,r.payload.sourceRecordId,r.payload.prefix,r.payload.part,r.payload.date,r.payload.time,r.payload.km,r.payload.workOrder,r.payload.mechanic,r.payload.movementType,r.payload.movementEvidence,r.payload.quantity,rowLabels[r.status]||r.status,r.reason])];
  downloadData(csvDocument(lines),'jarvis-conferencia.csv','text/csv;charset=utf-8');
 }
 const step=preview?(preview.job.status==='integrated'||preview.job.status==='rolled_back'?4:3):operation==='prepare'?2:inspection||operation==='read'?1:0;
 const rows=preview?.rows.filter(r=>filter==='all'||r.status===filter)||[];
 return <div className="integration-workspace">
  <div className="workspace-heading"><div><span className="eyebrow">Integração supervisionada</span><h1>Da origem à evidência.</h1></div><span><ShieldCheck size={18}/>Publicação sob sua aprovação</span></div>
  <ol className="import-pipeline">{['Origem','Leitura semântica','Conciliação','Validação','Publicação'].map((stage,i)=><li key={stage} className={i===step?'current':i<step?'done':''} aria-current={i===step?'step':undefined}><span>{i+1}</span>{stage}</li>)}</ol>
  {operation&&<p className="operation-status" role="status"><LoaderCircle className="spin" size={18}/>{operationLabels[operation]}</p>}
  {error&&<div className="research-error" role="alert">{error}</div>}{notice&&<p className="operation-notice" role="status">{notice}</p>}
  {pendingJob&&!preview&&<div className="import-recovery"><p>A preparação de <b>{pendingJob.fileName}</b> foi salva. Carregue a conferência antes de aprovar.</p><button className="action-secondary" disabled={busy} onClick={()=>void open(pendingJob)}>Carregar conferência</button></div>}
  {!preview&&<section className="import-origin" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!active.current&&e.dataTransfer.files[0])void select(e.dataTransfer.files[0])}}>
   <FileUp size={34}/><div><h2>{file?.name||'Conecte uma nova fonte'}</h2><p>{inspection?inspection.count+' linhas · '+inspection.headers.length+' colunas identificadas':'Arraste seu arquivo ou selecione para conferir os dados.'}</p><small>CSV · até 4 MB · até 1.000 linhas · prefixos 001 a 559</small></div>
   <button className="action-secondary" disabled={busy} onClick={()=>input.current?.click()}>Selecionar CSV</button><input ref={input} hidden disabled={busy} type="file" accept=".csv,text/csv" onChange={e=>{if(e.target.files?.[0])void select(e.target.files[0]);e.target.value=''}}/>
  </section>}
  {inspection&&!preview&&!pendingJob&&<section className="mapping-panel">
   <h2>Reconhecer e conciliar</h2><p>Confira a sugestão de cada coluna. Campos com * são obrigatórios.</p>
   <div className="mapping-grid">{Object.entries(labels).map(([field,label])=><label key={field}>{label}<select disabled={busy} value={mapping[field as keyof ColumnMapping]??-1} onChange={e=>setMapping({...mapping,[field]:Number(e.target.value)})}><option value={-1}>Não informado</option>{inspection.headers.map((header,i)=><option key={i} value={i}>{header||'Coluna '+(i+1)}</option>)}</select><small>Exemplo: {inspection.samples.map(row=>row[mapping[field as keyof ColumnMapping]??-1]||'não informado').join(' · ')}</small></label>)}</div>
   <p className="data-note">Um documento pode conter várias peças. Natureza ausente não será convertida em saída confirmada. IDs gerados servem apenas para rastreabilidade.</p>
   <div className="action-row"><button className="action-primary" disabled={busy} onClick={()=>void stage()}>Conciliar no servidor</button><button className="text-action" disabled={busy} onClick={()=>{reset();setNotice('Leitura cancelada. Nenhum registro enviado.')}}>Cancelar leitura</button></div>
  </section>}
  {preview&&<section className="import-review" aria-busy={busy}>
   <div className="section-title"><div><span className="eyebrow">{statuses[preview.job.status]}</span><h2>{preview.job.fileName}</h2></div><div className="action-row"><button className="text-action" disabled={busy} onClick={()=>void open(preview.job)}>Atualizar conferência</button><button className="text-action" disabled={busy||previewStale} onClick={download}>Exportar conferência</button></div></div>
   {previewStale&&<p className="inline-warning" role="status">A conferência exibida precisa ser atualizada. A aprovação e a reversão estão suspensas até a leitura do estado atual no servidor.</p>}
   <p className="hash-line">SHA-256 do conteúdo recebido<br/><code>{preview.job.fileHash||'Não disponível nesta versão anterior'}</code></p>
   <div className="import-balances"><span><b>{preview.job.acceptedRows}</b>Estruturalmente válidos</span><span><b>{preview.job.duplicateRows}</b>Duplicados separados</span><span><b>{preview.job.quarantineRows}</b>Divergentes em quarentena</span></div>
   <p className="data-note">Validade estrutural não confirma saída. Duplicados e divergências não são publicados. Arquivos rejeitados permanecem fora da base.</p>
   <div className="movement-grid">{Object.entries(natures).map(([key,label])=><span key={key}><b>{preview.report.movements[key]||0}</b>{label}</span>)}</div>
   <p className="data-note">{preview.report.identifiers.provided} IDs da planilha · {preview.report.identifiers.generated} IDs de rastreio gerados. Confira se a natureza de cada linha é explícita ou inferida.</p>
   <div className="review-row-toolbar"><label>Revisar linhas<select value={filter} onChange={e=>{setFilter(e.target.value);setPage(1)}}><option value="all">Todas</option><option value="accepted">Estruturalmente válidas</option><option value="duplicate">Duplicadas</option><option value="quarantine">Quarentena / divergentes</option><option value="integrated">Publicadas</option><option value="rolled_back">Revertidas</option></select></label><span>{rows.length} linhas</span><button className="text-action" onClick={()=>{setFilter('quarantine');setPage(1)}}>Revisar divergências</button></div>
   <div className="staged-rows">{rows.slice((page-1)*15,page*15).map(row=><article key={row.rowNumber}>
    <div><strong>Linha {row.rowNumber} · {row.payload.prefix}</strong><span>{rowLabels[row.status]||row.status}</span></div><h3>{row.payload.part||'Sem descrição'}</h3>
    <p>ID: {row.payload.sourceRecordId||'Não informado'} · {row.payload.date} · Quantidade: {row.payload.quantity??'Não informada'}</p>
    <small>{natures[String(row.payload.movementType)]||'Natureza não informada'} · {row.payload.movementEvidence==='explicit'?'Explícita':row.payload.movementEvidence==='inferred'?'Inferida':'Sem evidência'}</small>{row.reason&&<p className="attention">{row.reason}</p>}
   </article>)}</div>{!rows.length&&<p className="empty-message">Nenhuma linha nesta classificação.</p>}
   {rows.length>15&&<div className="page-controls"><button disabled={page===1} onClick={()=>setPage(page-1)}>Anterior</button><span>{page} de {Math.ceil(rows.length/15)}</span><button disabled={page>=Math.ceil(rows.length/15)} onClick={()=>setPage(page+1)}>Próxima</button></div>}
   {preview.job.status==='review'?<div className="approval-gate"><label><input type="checkbox" disabled={busy||previewStale} checked={approved} onChange={e=>setApproved(e.target.checked)}/>Revisei o mapeamento e aprovo somente os {preview.job.acceptedRows} registros estruturalmente válidos.</label><div className="action-row"><button className="action-primary" disabled={busy||previewStale||!approved||!preview.job.acceptedRows} onClick={()=>void action('integrate')}>Aprovar e publicar</button><button className="text-action" disabled={busy||previewStale} onClick={()=>void action('cancel')}>Cancelar importação</button></div></div>:<div className="action-row">{preview.job.status==='integrated'&&<button className="text-action" disabled={busy||previewStale} onClick={()=>setRollbackOpen(true)}>Reverter importação</button>}<button className="action-secondary" disabled={busy} onClick={reset}>Nova importação</button></div>}
   <div className="decision-trail"><h3>Trilha da importação</h3>{preview.events?.map((event,i)=><p key={i}>{{import_review:'Preparação e revisão',import_integrate:'Aprovação e publicação',import_cancel:'Cancelamento',import_rollback:'Reversão'}[event.kind]||event.kind} · {new Date(event.created_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} · Conta {event.actor}</p>)}</div>
  </section>}
  <section className="import-versions"><div className="section-title"><h2>Versões recentes</h2><button className="text-action" disabled={jobsLoading||busy} onClick={()=>void loadJobs()}>Atualizar</button></div>
   {jobsLoading&&<p className="data-note" role="status">Carregando versões…</p>}{jobsError&&<p className="inline-warning" role="alert">{jobsError} Use Atualizar para tentar novamente.</p>}
   {jobs.map(job=><button className="import-version" key={job.id} disabled={busy} onClick={()=>void open(job)}><span><b>{job.fileName}</b><small>{new Date(job.createdAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} · {job.totalRows} linhas</small></span><span>{statuses[job.status]||job.status}</span></button>)}
   {!jobsLoading&&!jobsError&&!jobs.length&&<p className="data-note">Nenhuma importação disponível para sua conta.</p>}
  </section>
  {auditError?<p className="inline-warning" role="alert">{auditError}</p>:<AdminAuditPanel audit={audit}/>}
  <AlertDialog open={rollbackOpen} onOpenChange={open=>{if(!busy)setRollbackOpen(open)}}><AlertDialogContent className="orbit-confirmation"><AlertDialogHeader><AlertDialogTitle>Reverter esta importação?</AlertDialogTitle><AlertDialogDescription>Serão retirados da base complementar somente os registros publicados por {preview?.job.fileName}. A origem, a trilha da importação e os resultados das consultas anteriores permanecerão preservados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Manter importação</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={e=>{e.preventDefault();void action('rollback')}}>{busy?'Revertendo…':'Confirmar reversão'}</AlertDialogAction></AlertDialogFooter>{error&&<p className="inline-warning" role="alert">{error}</p>}</AlertDialogContent></AlertDialog>
 </div>;
}
