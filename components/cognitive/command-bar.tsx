'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {Activity,ArrowUp,BusFront,ImagePlus,Mic,ScanBarcode,Square} from 'lucide-react';
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import type {CatalogData} from '@/lib/fleet';
type Speech={lang:string;interimResults:boolean;onresult:((e:{results:{[n:number]:{[n:number]:{transcript:string}}}})=>void)|null;onerror:((e:{error:string})=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void;abort:()=>void};
export function CommandBar({onSubmit,catalog,prefix='',onSelectVehicle,compact=false,disabled=false}:{onSubmit:(q:string)=>void;catalog:CatalogData|null;prefix?:string;onSelectVehicle?:()=>void;compact?:boolean;disabled?:boolean}){const id=useId(),[text,setText]=useState(''),[open,setOpen]=useState(false),[reading,setReading]=useState(false),[progress,setProgress]=useState(0),[notice,setNotice]=useState(''),[extracted,setExtracted]=useState(''),[listening,setListening]=useState(false),speech=useRef<Speech|null>(null),file=useRef<HTMLInputElement>(null),worker=useRef<import('tesseract.js').Worker|null>(null),generation=useRef(0),imageActive=useRef(false);useEffect(()=>()=>{generation.current++;speech.current?.abort();void worker.current?.terminate().catch(()=>{})},[]);
 function voice(){if(listening){speech.current?.stop();return}const w=window as unknown as {SpeechRecognition?:new()=>Speech;webkitSpeechRecognition?:new()=>Speech},Recognition=w.SpeechRecognition||w.webkitSpeechRecognition;if(!Recognition){setNotice('Reconhecimento de voz indisponível. Use o ditado do teclado ou digite.');return}const r=new Recognition();speech.current=r;r.lang='pt-BR';r.interimResults=false;r.onresult=e=>{const transcript=e.results[0][0].transcript;setText(transcript.slice(0,500));setNotice(transcript.length>500?'A transcrição excedeu o limite e foi reduzida. Revise antes de enviar.':'Transcrição pronta. Revise prefixo e peça antes de enviar.')};r.onerror=()=>setNotice('Não foi possível usar o microfone. A consulta por texto continua disponível.');r.onend=()=>setListening(false);try{r.start();setListening(true);setNotice('Ouvindo. O navegador pode usar seu serviço de reconhecimento de voz.')}catch{setNotice('Microfone indisponível neste navegador.')}}
 async function image(f:File){if(imageActive.current||disabled)return;setOpen(true);setExtracted('');setNotice('');if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>6*1024*1024){setNotice('Selecione JPG, PNG ou WebP de até 6 MB.');return}const token=++generation.current;imageActive.current=true;setReading(true);setProgress(0);let w:import('tesseract.js').Worker|null=null;try{const bitmap=await createImageBitmap(f);if(bitmap.width*bitmap.height>24000000){bitmap.close();throw new Error('Use uma imagem de até 24 megapixels.')}const canvas=document.createElement('canvas'),ratio=Math.min(1,1800/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const Detector=(window as unknown as {BarcodeDetector?:new()=>{detect:(image:HTMLCanvasElement)=>Promise<{rawValue:string}[]>}}).BarcodeDetector;if(Detector){const codes=await new Detector().detect(canvas).catch(()=>[]);if(codes.length){if(token===generation.current)setExtracted(codes.map(c=>c.rawValue).join('\n'));return}}if(token!==generation.current)return;const {createWorker}=await import('tesseract.js');w=await createWorker('por',1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr/core',langPath:'/ocr/lang',workerBlobURL:false,logger:m=>{if(token===generation.current&&m.status==='recognizing text')setProgress(Math.round(m.progress*100))}});if(token!==generation.current)return;worker.current=w;const result=await w.recognize(canvas);if(token===generation.current){setExtracted(result.data.text.slice(0,2000));setNotice('Revise o texto extraído. A foto não confirma compatibilidade nem diagnóstico.')}}catch(e){if(token===generation.current)setNotice(e instanceof Error?e.message:'Não foi possível ler a imagem.')}finally{await w?.terminate().catch(()=>{});if(worker.current===w)worker.current=null;if(token===generation.current){imageActive.current=false;setReading(false)}}}
 const codes:string[]=extracted.match(/\b\d{4,6}\b/g)||[],candidates=catalog?.materials.filter(m=>codes.includes(m.code)).slice(0,10)||[];function apply(value:string){setText(prefix?`${value} do prefixo ${prefix}`:value);setOpen(false)}

 const controls=<div className="command-tools">
  <button type="button" disabled={disabled} aria-label={listening?'Parar reconhecimento de voz':'Falar uma consulta'} title={listening?'Parar':'Falar'} aria-pressed={listening} onClick={voice}>{listening?<Square/>:<Mic/>}<span>{listening?'Parar':'Falar'}</span></button>
  <button type="button" aria-label="Ler imagem da peça ou do código" title="Ler imagem" onClick={()=>file.current?.click()}><ImagePlus/><span>Ler imagem</span></button>
  <button type="button" aria-label="Código da peça" title="Código da peça" onClick={()=>setOpen(true)}><ScanBarcode/><span>Código da peça</span></button>
  {onSelectVehicle?<button type="button" aria-label="Selecionar veículo" title="Selecionar veículo" onClick={onSelectVehicle}><BusFront/><span>Veículo</span></button>:!compact&&<span>Revise antes de pesquisar.</span>}
 </div>;
 return <section className={'command-surface'+(compact?' command-inline':'')}>
  <form onSubmit={e=>{e.preventDefault();if(!disabled&&text.trim())onSubmit(text.trim())}}>
   <span className="command-mark" aria-hidden="true"><Activity size={21}/></span>
   <label className="sr-only" htmlFor={id}>O que você precisa descobrir sobre a frota?</label>
   <input id={id} disabled={disabled} value={text} onChange={e=>setText(e.target.value)} placeholder="O que você precisa descobrir sobre a frota?" maxLength={500}/>
   {compact&&controls}
   <button type="submit" className="command-send" disabled={disabled||!text.trim()} aria-label="Enviar comando"><ArrowUp size={20}/></button>
  </form>
  {!compact&&controls}
  <input type="file" disabled={disabled||reading} ref={file} accept="image/jpeg,image/png,image/webp" hidden onChange={e=>{if(e.target.files?.[0])void image(e.target.files[0]);e.target.value=''}}/>
  {notice&&!open&&<p role="status">{notice}</p>}
  <Sheet open={open} onOpenChange={setOpen}><SheetContent className="query-detail-sheet"><SheetHeader><SheetTitle>Identificação assistida</SheetTitle><SheetDescription>OCR local de rótulos e códigos. A imagem não é enviada a uma IA externa.</SheetDescription></SheetHeader><div className="query-detail-body">
   {reading?<div role="status"><p>Lendo imagem… {progress}%</p><progress max={100} value={progress}/><button type="button" onClick={()=>{generation.current++;imageActive.current=false;void worker.current?.terminate().catch(()=>{});worker.current=null;setReading(false);setNotice('Leitura cancelada. Nenhuma consulta foi realizada.')}}>Cancelar leitura</button></div>:<>
    <button className="action-secondary" onClick={()=>file.current?.click()}>Selecionar imagem</button>
    <label className="research-field"><span>Texto ou código identificado</span><textarea rows={5} value={extracted} maxLength={2000} onChange={e=>setExtracted(e.target.value)}/></label>
    {candidates.map(m=><button className="candidate" key={m.code} onClick={()=>apply(m.canonical+' '+m.code)}><b>{m.code}</b>{m.canonical}<small>Confirmar identificação</small></button>)}
    <button className="action-primary" disabled={!extracted.trim()} onClick={()=>apply(extracted.slice(0,400))}>Usar texto e revisar</button>
   </>}
   {notice&&<p role="status">{notice}</p>}
   <p className="data-note">Código de barras depende do navegador. OCR e digitação continuam disponíveis.</p>
  </div></SheetContent></Sheet>
 </section>;
}
