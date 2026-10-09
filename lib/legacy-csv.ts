import type { Maintenance } from "@/lib/maintenance";

const columns = ["prefixo", "peca", "data", "km", "responsavel", "os", "origem", "observacao"];
const isIsoDate=(value:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const parsed=new Date(`${value}T00:00:00Z`);return !Number.isNaN(parsed.valueOf())&&parsed.toISOString().slice(0,10)===value;};

export function parseCsv(content:string):Omit<Maintenance,"id">[] {
  const source=content.replace(/^\uFEFF/,"").trim();
  const delimiter=source.split(/\r?\n/,1)[0].includes(";")?";":",";
  const rows:string[][]=[]; let row:string[]=[],field="",quoted=false;
  for(let i=0;i<source.length;i++) {
    const c=source[i];
    if(c==='"') { if(quoted&&source[i+1]==='"'){field+='"';i++;}else quoted=!quoted; }
    else if(c===delimiter&&!quoted){row.push(field.trim());field="";}
    else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&source[i+1]==="\n")i++;row.push(field.trim());if(row.some(Boolean))rows.push(row);row=[];field="";}
    else field+=c;
  }
  if(quoted)throw new Error("Há aspas não fechadas no CSV.");
  row.push(field.trim());if(row.some(Boolean))rows.push(row);
  const header=rows.shift()?.map(x=>x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""));
  if(!header||!columns.every(c=>header.includes(c)))throw new Error("Cabeçalho incompleto. Use o modelo CSV.");
  if(!rows.length||rows.length>300)throw new Error("Inclua de 1 a 300 linhas por arquivo.");
  return rows.map((cells,i)=>{
    const get=(key:string)=>cells[header.indexOf(key)]?.trim()||"";
    const raw=get("data"); const date=/^\d{2}\/\d{2}\/\d{4}$/.test(raw)?raw.split("/").reverse().join("-"):raw;
    const rawKm=get("km").replace(/\./g,"");const km=rawKm?Number(rawKm):null;
    if(!/^55\d{3}$/.test(get("prefixo"))||!get("peca")||!isIsoDate(date)||!get("origem")||(km!==null&&(!Number.isInteger(km)||km<0||km>9999999)))throw new Error(`Confira a linha ${i+2}. O prefixo deve seguir o padrão 55xxx.`);
    return {prefix:get("prefixo"),part:get("peca"),date,km,mechanic:get("responsavel")||null,workOrder:get("os")||null,source:get("origem"),notes:get("observacao")||null};
  });
}
