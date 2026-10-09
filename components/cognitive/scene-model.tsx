'use client';

import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {Disc3,Fan,Gauge,Layers3,Settings2,Zap} from 'lucide-react';
import type {FleetItem} from '@/lib/fleet';
import {systems,type CognitiveIndex,type SystemId} from '@/lib/cognitive';
import {sceneConnector,sceneHotspots,sceneSpace} from '@/lib/scene-hud';
import {DigitalTwin} from './digital-twin';

const icons={motor:Gauge,transmissao:Settings2,freios:Disc3,arrefecimento:Fan,eletrico:Zap};
type Connection=NonNullable<ReturnType<typeof sceneConnector>>&{id:SystemId};

export function SceneModel({vehicle,index,selected,onSystem,plain,onPlainChange}:{vehicle:FleetItem|null;index?:CognitiveIndex['vehicles'][string];selected:SystemId;onSystem:(id:SystemId)=>void;plain:boolean;onPlainChange:()=>void}){
 const frame=useRef<HTMLDivElement>(null),labels=useRef<Partial<Record<SystemId,HTMLButtonElement>>>({});
 const [failed,setFailed]=useState(false),[connections,setConnections]=useState<Connection[]>([]);
 useEffect(()=>{
  if(plain||failed||!frame.current)return;
  let raf=0;
  const measure=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{
   const element=frame.current;if(!element)return;
   const rect=element.getBoundingClientRect();
   const next=systems.flatMap(s=>{const label=labels.current[s.id];if(!label||!label.getClientRects().length)return [];const path=sceneConnector(rect,label.getBoundingClientRect(),s.id);return path?[{...path,id:s.id}]:[]});
   setConnections(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);
  })};
  if(typeof ResizeObserver==='undefined'){measure();window.addEventListener('resize',measure);return()=>{window.removeEventListener('resize',measure);cancelAnimationFrame(raf)}}
  const observer=new ResizeObserver(measure);observer.observe(frame.current);
  Object.values(labels.current).forEach(element=>{if(element)observer.observe(element)});
  measure();return()=>{observer.disconnect();cancelAnimationFrame(raf)};
 },[plain,failed]);

 return <figure className={`scene-model ${plain?'is-plain':''}`} aria-label="Visualização ilustrativa dos sistemas do veículo">
  <div className="scene-model-canvas" ref={frame}>
   {failed?<div className="scene-model-fallback"><DigitalTwin vehicle={vehicle} index={index} selected={selected} onSystem={onSystem}/><p>Ilustração indisponível. Os sistemas continuam acessíveis.</p></div>:<>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className="scene-bus-image" src="/visuals/jarvis-bus-cutaway.webp" width="1536" height="1024" alt="Ilustração conceitual de ônibus com sistemas expostos. Não representa a arquitetura mecânica real do prefixo selecionado." fetchPriority="high" decoding="async" onError={()=>setFailed(true)}/>
    <svg className="scene-connectors" viewBox={`0 0 ${sceneSpace.width} ${sceneSpace.height}`} aria-hidden="true">{connections.map(c=><g key={c.id} className={selected===c.id?'is-selected':''}><path d={c.path}/><circle cx={c.tx} cy={c.ty} r="4"/></g>)}</svg>
   </>}
   {!failed&&<div className="scene-hotspots" role="group" aria-label="Selecionar um sistema na ilustração">{systems.map(s=>{const Icon=icons[s.id],anchor=sceneHotspots[s.id];return <button key={s.id} ref={element=>{if(element)labels.current[s.id]=element;else delete labels.current[s.id]}} className={`scene-hotspot hotspot-${s.id}`} style={{'--hotspot-x':`${anchor.x}%`,'--hotspot-y':`${anchor.y}%`} as CSSProperties} aria-pressed={selected===s.id} aria-label={`${s.label}: ${index?index.systems[s.id].count.toLocaleString('pt-BR')+' movimentações na base':'carregando registros'}`} onClick={()=>onSystem(s.id)}><Icon size={19}/><span>{s.label}</span></button>})}</div>}
  </div>
  <figcaption><span>Visualização ilustrativa</span><button className="scene-view-option" aria-pressed={plain} onClick={onPlainChange}><Layers3 size={15}/>{plain?'Ver ilustração':'Visualização simples'}</button><span className="sr-only">A ilustração não confirma arquitetura técnica, instalação ou compatibilidade de peças.</span></figcaption>
 </figure>;
}
