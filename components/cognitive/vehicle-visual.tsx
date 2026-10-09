'use client';
import {useState} from 'react';
import {BusFront,ImageOff} from 'lucide-react';
import {resolveVehicleVisual} from '@/lib/vehicle-visuals';
import type {VehicleProfile} from '@/lib/fleet';

export function VehicleVisual({vehicle}:{vehicle:VehicleProfile|null}){
 const visual=resolveVehicleVisual(vehicle);
 return <VehicleImage key={visual.photo?.id||'unavailable'} visual={visual}/>;
}
function VehicleImage({visual}:{visual:ReturnType<typeof resolveVehicleVisual>}){
 const [failed,setFailed]=useState(false),photo=visual.photo;
 return <figure className={`vehicle-visual visual-${visual.kind}`}>
  <div className="vehicle-visual-frame">{photo&&!failed?<>
   {/* eslint-disable-next-line @next/next/no-img-element */}
   <img src={photo.src} width="728" height="421" alt={`Fotografia da frota enviada pelo usuário. Em primeiro plano, prefixo ${photo.prefix}, placa ${photo.plate}.`} loading="lazy" decoding="async" onError={()=>setFailed(true)}/>
  </>:<div className="vehicle-visual-empty">{failed?<ImageOff size={36} strokeWidth={1.3}/>:<BusFront size={48} strokeWidth={1.2}/>}<strong>{failed?'Foto indisponível':visual.label}</strong><span>{failed?'Os dados e as consultas continuam disponíveis.':visual.description}</span></div>}</div>
  {photo&&!failed&&<figcaption><strong>{visual.label}</strong><span>{visual.description}</span></figcaption>}
 </figure>;
}
