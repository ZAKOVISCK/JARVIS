'use client';

import {useState} from 'react';
import {formatDate} from '@/lib/fleet';
import type {SearchSnapshot} from '@/lib/validated-search';

export function EvidenceComparison({record}:{record:SearchSnapshot}) {
  const [ids,setIds]=useState([record.evidence[0]?.id||'',record.evidence[1]?.id||'']);
  if(record.evidence.length<2)return null;
  return <details className="evidence-alternatives">
    <summary>Comparar evidências alternativas</summary>
    <p className="data-note">Confronte os documentos considerados nesta consulta. A comparação não altera a validação nem o resultado preservado.</p>
    <div className="comparison-grid">{ids.map((id,i)=>{
      const e=record.evidence.find(item=>item.id===id);
      const assessment=record.assessments?.find(item=>item.recordId===id);
      return <article key={i}>
        <label className="research-field"><span>Evidência {i+1}</span>
          <select value={id} onChange={event=>setIds(ids.map((value,index)=>index===i?event.target.value:value))}>
            {record.evidence.map(item=><option key={item.id} value={item.id}>{formatDate(item.date)} · {item.id} · {item.part}</option>)}
          </select>
        </label>
        {e&&<><h3>{e.part}</h3><dl>{[
          ['Data / hora',`${formatDate(e.date)} · ${e.time||'Hora não informada'}`],
          ['KM',e.km?.toLocaleString('pt-BR')??'Não informado'],
          ['Quantidade',e.quantity?.toLocaleString('pt-BR')??'Não informada'],
          ['Lançamento',e.document||'Não informado'],
          ['O.S.',e.workOrder||'Não informada'],
          ['Responsável na origem',e.responsible||'Não informado'],
          ['Fonte',`${e.sourceFile} · Linha ${e.sourceLine??'não informada'}`],
          ['Elegibilidade',assessment?(assessment.eligible?'Elegível pelas regras documentais':'Não elegível'):'Não avaliada individualmente'],
        ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        {assessment?.reasons.map(reason=><p key={reason}>{reason}</p>)}</>}
      </article>;
    })}</div>
  </details>;
}
