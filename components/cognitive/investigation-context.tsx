'use client';
import {CalendarDays,ChevronRight,Disc3,Fan,FileText,Gauge,Settings2,Zap} from 'lucide-react';
import {formatDate,formatPrefix,type FleetItem} from '@/lib/fleet';
import {systems,type CognitiveIndex,type SystemId} from '@/lib/cognitive';
import {resolveVehicleVisual} from '@/lib/vehicle-visuals';
import {VehicleVisual} from './vehicle-visual';
const icons={motor:Gauge,transmissao:Settings2,freios:Disc3,arrefecimento:Fan,eletrico:Zap};
export function InvestigationContext({vehicle,index,selected,onSystem,disabled}:{vehicle:FleetItem|null;index?:CognitiveIndex['vehicles'][string];selected:SystemId;onSystem:(id:SystemId)=>void;disabled:boolean}){
 const active=systems.find(s=>s.id===selected)!,stats=index?.systems[selected],illustrative=!!vehicle&&!resolveVehicleVisual(vehicle).photo;
 return <section className="investigation-vehicle surface" aria-label="Contexto do veículo">
  <header><div><h2>Contexto do veículo</h2><strong>{vehicle?formatPrefix(vehicle.code):'Informe o prefixo'}</strong><small>{vehicle?`${vehicle.brand||'Marca não informada'} · ${vehicle.model||'Modelo não informado'}`:'Escolha um veículo nos critérios da consulta.'}</small></div></header>
  <VehicleVisual vehicle={vehicle} illustrativeFallback/>
  {illustrative&&<p className="approved-context-illustration">Ilustração genérica · não representa este prefixo.</p>}
  <div className="investigation-systems" role="group" aria-label="Consultar um sistema">{systems.map(s=>{const Icon=icons[s.id];return <button key={s.id} disabled={disabled||!vehicle} aria-pressed={selected===s.id} onClick={()=>onSystem(s.id)}><Icon size={22}/><span>{s.label}</span><ChevronRight size={15}/></button>})}</div>
  <div className="approved-vehicle-facts"><span><CalendarDays size={18}/>{vehicle?.year?'Ano '+vehicle.year:'Ano não informado'}</span><span><FileText size={18}/>{vehicle?vehicle.parts.toLocaleString('pt-BR')+' movimentações':'— movimentações'}</span></div>
  <details className="investigation-system-note"><summary>{active.label} · {stats?stats.count.toLocaleString('pt-BR'):'—'} movimentações</summary><small>{stats?.last?`Último registro: ${formatDate(stats.last)}`:'Sem data disponível'} · Base integrada</small>{illustrative&&<p>Foto correspondente não disponível. Carroceria e configuração mecânica não verificadas; a ilustração não comprova identidade nem compatibilidade.</p>}</details>
  <p className="investigation-disclosure">Movimentações não comprovam instalação.</p>
 </section>;
}
