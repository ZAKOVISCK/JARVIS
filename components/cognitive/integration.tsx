'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowRight,Check,CheckCircle2,ChevronDown,Clock3,Copy,Database,Download,FileCheck2,FileText,FileUp,History,Info,LoaderCircle,RefreshCw,ShieldCheck,TriangleAlert,XCircle} from 'lucide-react';
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
const eventLabels:Record<string,string>={import_review:'Preparação e revisão',import_integrate:'Aprovação e publicação',import_cancel:'Cancelamento',import_rollback:'Reversão'};
const number=(value:number)=>value.toLocaleString('pt-BR');
const dateTime=(value:string)=>new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
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
 return <div className="integration-workspace approved-integration">
  <div className="workspace-heading"><div><h1>Da origem à evidência.</h1><p>Integração supervisionada.</p></div><span className="integration-assurance"><ShieldCheck size={24}/>Publicação sob sua aprovação</span></div>
  <ol className="import-pipeline">{['Origem','Leitura','Conciliação','Validação','Publicação'].map((stage,i)=><li key={stage} className={i===step?'current':i<step?'done':''} aria-current={i===step?'step':undefined}><span>{i+1}</span><b>{stage}</b>{i<step&&<CheckCircle2 size={17} aria-label="Etapa concluída"/>}</li>)}</ol>
  {operation&&<p className="operation-status" role="status"><LoaderCircle className="spin" size={18}/>{operationLabels[operation]}</p>}
  {error&&<div className="research-error" role="alert">{error}</div>}{notice&&<p className="operation-notice" role="status">{notice}</p>}
  {pendingJob&&!preview&&<div className="import-recovery"><p>A preparação de <b>{pendingJob.fileName}</b> foi salva. Carregue a conferência antes de aprovar.</p><button className="action-secondary" disabled={busy} onClick={()=>void open(pendingJob)}>Carregar conferência</button></div>}
  <div className="integration-review-layout" aria-busy={busy}>
   <div className="integration-main">
    {!preview&&<section className="import-origin" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!active.current&&e.dataTransfer.files[0])void select(e.dataTransfer.files[0])}}>
     <span className="import-file-icon"><FileUp size={30}/></span><div><span className="eyebrow">{inspection?'Fonte recebida · mapeamento local':'Sua próxima fonte'}</span><h2>{file?.name||'Conecte uma nova fonte'}</h2><p>{inspection?number(inspection.count)+' linhas · '+inspection.headers.length+' colunas identificadas':'Arraste seu arquivo ou selecione para conferir os dados.'}</p><small>CSV · até 4 MB · até 1.000 linhas · prefixos 001 a 559</small></div>
     <button className="action-secondary" disabled={busy} onClick={()=>input.current?.click()}>Selecionar CSV<ArrowRight size={16}/></button><input ref={input} hidden disabled={busy} type="file" accept=".csv,text/csv" onChange={e=>{if(e.target.files?.[0])void select(e.target.files[0]);e.target.value=''}}/>
    </section>}
    {inspection&&!preview&&!pendingJob&&<section className="mapping-panel">
     <div className="section-title"><div><span className="eyebrow">Leitura semântica</span><h2>Reconhecer e conciliar</h2></div><FileCheck2 size={24}/></div><p>Confira a sugestão de cada coluna. Campos com * são obrigatórios.</p>
     <div className="mapping-grid">{Object.entries(labels).map(([field,label])=><label key={field}>{label}<select disabled={busy} value={mapping[field as keyof ColumnMapping]??-1} onChange={e=>setMapping({...mapping,[field]:Number(e.target.value)})}><option value={-1}>Não informado</option>{inspection.headers.map((header,i)=><option key={i} value={i}>{header||'Coluna '+(i+1)}</option>)}</select><small>Exemplo: {inspection.samples.map(row=>row[mapping[field as keyof ColumnMapping]??-1]||'não informado').join(' · ')}</small></label>)}</div>
     <p className="data-note">Um documento pode conter várias peças. Natureza ausente não será convertida em saída confirmada. IDs gerados servem apenas para rastreabilidade.</p>
     <div className="action-row"><button className="action-primary" disabled={busy} onClick={()=>void stage()}>Conciliar no servidor<ArrowRight size={16}/></button><button className="text-action" disabled={busy} onClick={()=>{reset();setNotice('Leitura cancelada. Nenhum registro enviado.')}}>Cancelar leitura</button></div>
    </section>}
    {preview?<section className="import-review">
     <div className="import-file-heading"><span className="import-file-icon"><FileText size={30}/></span><div><div className="import-file-title"><h2>{preview.job.fileName}</h2><span className={'import-state-badge '+preview.job.status}><Clock3 size={15}/>{statuses[preview.job.status]||preview.job.status}</span></div><p>{number(preview.job.totalRows)} linhas · Fonte preservada na conferência</p></div><button className="action-secondary" disabled={busy} onClick={()=>void open(preview.job)}><RefreshCw size={16}/>Atualizar conferência</button></div>
     {previewStale&&<p className="inline-warning" role="status">A conferência exibida precisa ser atualizada. A aprovação e a reversão estão suspensas até a leitura do estado atual no servidor.</p>}
     <div className="import-balances"><div className="import-balance-valid"><span><FileCheck2 size={25}/></span><div><b>{number(preview.job.acceptedRows)}</b><small>Estruturalmente válidos</small></div></div><div className="import-balance-duplicate"><span><Copy size={25}/></span><div><b>{number(preview.job.duplicateRows)}</b><small>Duplicados separados</small></div></div><div className="import-balance-quarantine"><span><TriangleAlert size={25}/></span><div><b>{number(preview.job.quarantineRows)}</b><small>Em quarentena</small></div></div></div>
     <section className="import-records-panel" aria-labelledby="import-records-title">
      <div className="import-records-heading"><h2 id="import-records-title">Conferência dos registros</h2><div className="import-filter-tabs" role="group" aria-label="Classificar registros">{[['all','Todos'],['accepted','Válidos'],['duplicate','Duplicados'],['quarantine','Quarentena']].map(([value,label])=><button key={value} type="button" aria-pressed={filter===value} onClick={()=>{setFilter(value);setPage(1)}}>{label}</button>)}</div></div>
      <div className="import-table-wrap" tabIndex={0} aria-label="Conferência dos registros; role para revisar todas as linhas"><table className="import-review-table"><caption className="integration-visually-hidden">Registros preparados para conferência. Validade estrutural não confirma saída.</caption><thead><tr><th scope="col">Prefixo</th><th scope="col">Peça e origem</th><th scope="col">Natureza</th><th scope="col">Qtd.</th><th scope="col">Estado</th></tr></thead><tbody>{rows.slice((page-1)*15,page*15).map(row=><tr key={row.rowNumber} className={'import-row-'+row.status}>
       <td data-label="Prefixo"><strong>{row.payload.prefix||'Não informado'}</strong><small>Linha {row.rowNumber}</small></td><td data-label="Peça e origem"><strong>{row.payload.part||'Sem descrição'}</strong><details className="import-row-detail"><summary>Rastreabilidade</summary><dl><div><dt>ID de origem</dt><dd>{row.payload.sourceRecordId||'Não informado'}</dd></div><div><dt>Data</dt><dd>{row.payload.date||'Não informada'}</dd></div><div><dt>Origem</dt><dd>{row.payload.source||'Não informada'}</dd></div><div><dt>Evidência</dt><dd>{row.payload.movementEvidence==='explicit'?'Explícita':row.payload.movementEvidence==='inferred'?'Inferida':'Sem evidência'}</dd></div>{row.payload.time&&<div><dt>Horário</dt><dd>{row.payload.time}</dd></div>}{row.payload.km!==null&&row.payload.km!==undefined&&row.payload.km!==''&&<div><dt>KM informado</dt><dd>{row.payload.km}</dd></div>}{row.payload.workOrder&&<div><dt>O.S.</dt><dd>{row.payload.workOrder}</dd></div>}{row.payload.mechanic&&<div><dt>Responsável</dt><dd>{row.payload.mechanic}</dd></div>}</dl></details></td><td data-label="Natureza">{natures[String(row.payload.movementType)]||'Natureza não informada'}<small>{row.payload.movementEvidence==='explicit'?'Explícita':row.payload.movementEvidence==='inferred'?'Inferida':'Sem evidência'}</small></td><td data-label="Quantidade">{row.payload.quantity===null||row.payload.quantity===undefined||row.payload.quantity===''?'Não informada':row.payload.quantity}</td><td data-label="Estado"><span className="import-row-status">{row.status==='quarantine'?<TriangleAlert size={18}/>:row.status==='duplicate'?<Copy size={18}/>:row.status==='rolled_back'?<History size={18}/>:<CheckCircle2 size={18}/>}<span>{rowLabels[row.status]||row.status}</span></span>{row.reason&&<p className="attention">{row.reason}</p>}</td>
      </tr>)}</tbody></table></div>{!rows.length&&<p className="empty-message">Nenhuma linha nesta classificação.</p>}
      {rows.length>15&&<div className="page-controls"><button disabled={page===1} onClick={()=>setPage(page-1)}>Anterior</button><span>{page} de {Math.ceil(rows.length/15)}</span><button disabled={page>=Math.ceil(rows.length/15)} onClick={()=>setPage(page+1)}>Próxima</button></div>}
      <p className="import-structural-note"><Info size={16}/>Validade estrutural não confirma saída. Duplicados e divergências não são publicados.</p>
     </section>
     <details className="import-technical-report"><summary>Relatório e filtros detalhados de conciliação</summary><div className="review-row-toolbar"><label>Revisar linhas<select value={filter} onChange={e=>{setFilter(e.target.value);setPage(1)}}><option value="all">Todas</option><option value="accepted">Estruturalmente válidas</option><option value="duplicate">Duplicadas</option><option value="quarantine">Quarentena / divergentes</option><option value="integrated">Publicadas</option><option value="rolled_back">Revertidas</option></select></label><span>{number(rows.length)} linhas</span><button className="text-action" onClick={()=>{setFilter('quarantine');setPage(1)}}>Revisar divergências</button></div><div className="movement-grid">{Object.entries(natures).map(([key,label])=><span key={key}><b>{number(preview.report.movements[key]||0)}</b>{label}</span>)}</div><p className="data-note">{number(preview.report.identifiers.provided)} IDs da planilha · {number(preview.report.identifiers.generated)} IDs de rastreio gerados. Confira se a natureza de cada linha é explícita ou inferida. Arquivos rejeitados permanecem fora da base.</p><p className="hash-line">SHA-256 do conteúdo recebido<br/><code>{preview.job.fileHash||'Não disponível nesta versão anterior'}</code></p></details>
    </section>:!inspection&&<section className="import-awaiting-source"><div className="import-balances"><div className="import-balance-valid"><span><FileCheck2 size={25}/></span><div><b>—</b><small>Estruturalmente válidos</small></div></div><div className="import-balance-duplicate"><span><Copy size={25}/></span><div><b>—</b><small>Duplicados separados</small></div></div><div className="import-balance-quarantine"><span><TriangleAlert size={25}/></span><div><b>—</b><small>Em quarentena</small></div></div></div><div className="import-empty-conference"><FileCheck2 size={38}/><h2>Conferência dos registros</h2><p>Selecione uma fonte para reconhecer as colunas, conciliar os registros e revisar cada evidência.</p><span><ShieldCheck size={16}/>Nenhum registro é publicado durante a preparação.</span></div></section>}
    <section className="decision-trail import-event-trail"><h2>Trilha da importação</h2>{preview?<ol>{preview.events?.map((event,i)=><li key={i}><span className="import-event-icon">{event.kind==='import_integrate'?<CheckCircle2 size={23}/>:event.kind==='import_rollback'?<History size={23}/>:event.kind==='import_cancel'?<XCircle size={23}/>:<FileText size={23}/>}</span><div><b>{eventLabels[event.kind]||event.kind}</b><time dateTime={event.created_at}>{dateTime(event.created_at)}</time><small>Conta {event.actor}</small></div></li>)}{preview.job.status==='review'&&<li className="import-event-awaiting"><span className="import-event-icon"><Clock3 size={23}/></span><div><b>{previewStale?'Conferência pendente de atualização':'Aguardando sua revisão'}</b><small>{previewStale?'Leia o estado atual no servidor antes de continuar.':'A publicação requer aprovação humana.'}</small></div></li>}</ol>:<p className="data-note">A trilha aparecerá após a preparação no servidor, com os eventos e horários registrados.</p>}</section>
   </div>
   <aside className="import-approval-panel" aria-labelledby="import-approval-title"><h2 id="import-approval-title">Conferência e aprovação</h2><ul className="import-approval-checks">
    <li className={preview?'complete':''}>{preview?<CheckCircle2 size={24}/>:<Clock3 size={24}/>}<div><b>{preview?'Origem identificada':'Origem aguardando conferência'}</b><small>{preview?preview.job.fileName+' · '+number(preview.job.totalRows)+' linhas':file?file.name:'Selecione um arquivo CSV.'}</small></div></li>
    <li className={preview?'complete':''}>{preview?<CheckCircle2 size={24}/>:<Clock3 size={24}/>}<div><b>{preview?'Identificadores conferidos':'Identificadores e estrutura'}</b><small>{preview?number(preview.report.identifiers.provided)+' IDs informados · '+number(preview.report.identifiers.generated)+' gerados':'O servidor validará a estrutura e os prefixos.'}</small></div></li>
    <li className={preview?'complete':''}>{preview?<CheckCircle2 size={24}/>:<Clock3 size={24}/>}<div><b>{preview?'Duplicados separados':'Conciliação de duplicados'}</b><small>{preview?number(preview.job.duplicateRows)+' registros identificados':'A verificação precede a publicação.'}</small></div></li>
    <li className={preview?.job.quarantineRows?'attention':preview?'complete':''}>{preview?.job.quarantineRows?<TriangleAlert size={24}/>:preview?<CheckCircle2 size={24}/>:<Clock3 size={24}/>}<div><b>{preview?number(preview.job.quarantineRows)+' registros em quarentena':'Quarentena e divergências'}</b><small>{preview?'Confira os motivos na tabela de registros.':'Linhas divergentes ficam fora da publicação.'}</small></div></li>
   </ul><p className="import-publication-notice"><Info size={19}/>{previewStale?'Estado não confirmado. Atualize a conferência antes de aprovar ou reverter.':preview?.job.status==='integrated'?'Publicação registrada na trilha da importação.':preview?.job.status==='rolled_back'?'Importação revertida. A memória anterior permanece preservada.':preview?.job.status==='cancelled'?'Importação cancelada. Nenhuma linha publicada.':'Nenhum registro publicado nesta etapa.'}</p>
    {preview?.job.status==='review'?<div className="approval-gate"><label><input type="checkbox" disabled={busy||previewStale} checked={approved} onChange={e=>setApproved(e.target.checked)}/><span>Revisei o mapeamento e aprovo somente os <b>{number(preview.job.acceptedRows)}</b> registros estruturalmente válidos.</span></label><button className="action-primary" disabled={busy||previewStale||!approved||!preview.job.acceptedRows} onClick={()=>void action('integrate')}><Check size={18}/>Aprovar e publicar</button><button className="action-secondary" disabled={busy||previewStale} onClick={download}><Download size={18}/>Exportar conferência</button><button className="text-action" disabled={busy||previewStale} onClick={()=>void action('cancel')}>Cancelar importação</button></div>:preview?<div className="import-completed-actions"><button className="action-secondary" disabled={busy||previewStale} onClick={download}><Download size={18}/>Exportar conferência</button>{preview.job.status==='integrated'&&<button className="text-action" disabled={busy||previewStale} onClick={()=>setRollbackOpen(true)}><History size={18}/>Reverter importação</button>}<button className="action-secondary" disabled={busy} onClick={reset}>Nova importação<ArrowRight size={16}/></button></div>:<div className="approval-gate import-pending-approval"><label><input type="checkbox" disabled checked={false}/><span>A revisão dos registros libera a aprovação.</span></label><button className="action-primary" disabled><Check size={18}/>Aprovar e publicar</button></div>}
    <p className="import-human-note"><Info size={18}/>A publicação requer sua aprovação.</p>
   </aside>
  </div>
  <div className="integration-supporting-views">
   <details className="integration-extra integration-version-disclosure"><summary><FileText size={22}/><span><b>Versões recentes</b><small>Fontes preservadas</small></span><span className="integration-extra-status">{jobsLoading?'Carregando…':jobsError?'Histórico indisponível':number(jobs.length)+' '+(jobs.length===1?'versão':'versões')}<ChevronDown size={17}/></span></summary>
   <section className="import-versions"><div className="section-title"><div><span className="eyebrow">Fontes preservadas</span><h2>Versões recentes</h2></div><button className="text-action" disabled={jobsLoading||busy} onClick={()=>void loadJobs()}><RefreshCw size={15}/>Atualizar</button></div>
   {jobsLoading&&<p className="data-note" role="status">Carregando versões…</p>}{jobsError&&<p className="inline-warning" role="alert">{jobsError} Use Atualizar para tentar novamente.</p>}
   {jobs.map(job=><button className="import-version" key={job.id} disabled={busy} onClick={()=>void open(job)}><span className="import-version-document"><FileText size={23}/><span><b>{job.fileName}</b><small>{dateTime(job.createdAt)} · {number(job.totalRows)} linhas</small></span></span><span className={'import-state-badge '+job.status}>{statuses[job.status]||job.status}</span></button>)}
   {!jobsLoading&&!jobsError&&!jobs.length&&<p className="data-note">Nenhuma importação disponível para sua conta.</p>}
  </section>
   </details>
   <details className="integration-extra integration-audit-disclosure"><summary><Database size={22}/><span><b>Auditoria da base principal</b><small>Controle administrativo</small></span><span className="integration-extra-status">{auditError?'Indisponível':audit?'Abrir relatório':'Carregando…'}<ChevronDown size={17}/></span></summary>{auditError?<p className="inline-warning" role="alert">{auditError}</p>:<AdminAuditPanel audit={audit}/>}</details>
  </div>
  <AlertDialog open={rollbackOpen} onOpenChange={open=>{if(!busy)setRollbackOpen(open)}}><AlertDialogContent className="orbit-confirmation"><AlertDialogHeader><AlertDialogTitle>Reverter esta importação?</AlertDialogTitle><AlertDialogDescription>Serão retirados da base complementar somente os registros publicados por {preview?.job.fileName}. A origem, a trilha da importação e os resultados das consultas anteriores permanecerão preservados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Manter importação</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={e=>{e.preventDefault();void action('rollback')}}>{busy?'Revertendo…':'Confirmar reversão'}</AlertDialogAction></AlertDialogFooter>{error&&<p className="inline-warning" role="alert">{error}</p>}</AlertDialogContent></AlertDialog>
 </div>;
}
