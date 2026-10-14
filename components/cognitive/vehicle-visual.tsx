'use client';
import {useState} from 'react';
import {BusFront,ImageOff} from 'lucide-react';
import {resolveVehicleVisual} from '@/lib/vehicle-visuals';
import type {VehicleProfile} from '@/lib/fleet';

export function VehicleVisual({vehicle,illustrativeFallback=false}:{vehicle:VehicleProfile|null;illustrativeFallback?:boolean}){
 const visual=resolveVehicleVisual(vehicle);
 return <VehicleImage key={visual.photo?.id||'unavailable'} visual={visual} illustrativeFallback={illustrativeFallback&&!!vehicle}/>;
}
function VehicleImage({visual,illustrativeFallback}:{visual:ReturnType<typeof resolveVehicleVisual>;illustrativeFallback:boolean}){
 const [failed,setFailed]=useState(false),photo=visual.photo;
 const illustration=!photo&&illustrativeFallback&&!failed;
 return <figure className={`vehicle-visual visual-${visual.kind}${illustration?' visual-conceptual':''}`}>
  <div className="vehicle-visual-frame">{photo&&!failed?<>
   {/* eslint-disable-next-line @next/next/no-img-element */}
   <img src={photo.src} width="728" height="421" alt={`Fotografia da frota enviada pelo usuário. Em primeiro plano, prefixo ${photo.prefix}, placa ${photo.plate}.`} loading="lazy" decoding="async" onError={()=>setFailed(true)}/>
  </>:illustration?<>
   {/* eslint-disable-next-line @next/next/no-img-element */}
   <img src="/visuals/jarvis-bus-orbita-exterior.png" width="1774" height="887" alt="Ilustração conceitual de ônibus. Modelo genérico, sem correspondência verificada com o prefixo selecionado." loading="lazy" decoding="async" onError={()=>setFailed(true)}/>
  </>:<div className="vehicle-visual-empty">{failed?<ImageOff size={36} strokeWidth={1.3}/>:<BusFront size={48} strokeWidth={1.2}/>}<strong>{failed?'Imagem indisponível':visual.label}</strong><span>{failed?'Os dados e as consultas continuam disponíveis.':visual.description}</span></div>}</div>
  {photo&&!failed&&<figcaption><strong>{visual.label}</strong><span>{visual.description}</span></figcaption>}
  {illustration&&<figcaption><strong>Ilustração de referência · modelo genérico</strong><span>Não representa este prefixo. Foto correspondente não disponível; carroceria e configuração mecânica não verificadas.</span></figcaption>}
 </figure>;
}
