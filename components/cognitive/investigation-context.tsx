'use client';
import {BusFront,Disc3,Fan,Gauge,Settings2,Zap} from 'lucide-react';
import {formatDate,formatPrefix,type FleetItem} from '@/lib/fleet';
import {systems,type CognitiveIndex,type SystemId} from '@/lib/cognitive';
import {VehicleVisual} from './vehicle-visual';
const icons={motor:Gauge,transmissao:Settings2,freios:Disc3,arrefecimento:Fan,eletrico:Zap};
export function InvestigationContext({vehicle,index,selected,onSystem,disabled}:{vehicle:FleetItem|null;index?:CognitiveIndex['vehicles'][string];selected:SystemId;onSystem:(id:SystemId)=>void;disabled:boolean}){
 const active=systems.find(s=>s.id===selected)!,stats=index?.systems[selected];
 return <section className="investigation-vehicle" aria-label="Contexto do veículo">
  <header><BusFront size={20}/><div><span>Veículo em investigação</span><strong>{vehicle?formatPrefix(vehicle.code):'Informe o prefixo'}</strong><small>{vehicle?`${vehicle.brand} · ${vehicle.model}`:'Escolha um veículo nos critérios da consulta.'}</small></div></header>
  <VehicleVisual vehicle={vehicle}/>
  <div className="investigation-systems" role="group" aria-label="Consultar um sistema">{systems.map(s=>{const Icon=icons[s.id];return <button key={s.id} disabled={disabled||!vehicle} aria-pressed={selected===s.id} onClick={()=>onSystem(s.id)}><Icon size={18}/><span>{s.label}</span></button>})}</div>
  <div className="investigation-system-note"><span>{active.label}</span><strong>{stats?stats.count.toLocaleString('pt-BR'):'—'} movimentações</strong><small>{stats?.last?`Último registro: ${formatDate(stats.last)}`:'Sem data disponível'} · Base integrada</small></div>
  <p className="investigation-disclosure">A imagem acompanha o cadastro do prefixo. Movimentações não comprovam instalação.</p>
 </section>;
}
