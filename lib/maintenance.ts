export type Maintenance = {
  id: number; prefix: string; part: string; date: string; km: number | null;
  mechanic: string | null; workOrder: string | null; source: string; notes: string | null;
  sourceRecordId?: string | null; movementType?: "issue"|"return"|"reversal"|"entry"|"adjustment"|"unknown"|null; quantity?: number|null;
  movementEvidence?:string|null; sourceLine?:number|null;sourceFile?:string|null;time?:string|null;
};

export const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function searchRecords(records: Maintenance[], raw: string): Maintenance[] {
  const q = normalize(raw.trim());
  if (!q) return [...records].sort((a,b) => b.date.localeCompare(a.date));
  const prefix = q.match(/\b\d{5}\b/)?.[0];
  const stop = new Set(["quem","quando","qual","quais","data","km","quilometragem","trocou","troca","trocada","trocado","peca","pecas","do","da","de","dos","das","no","na","nos","nas","o","a","os","as","um","uma","carro","veiculo","onibus","prefixo","foi","foram","me","mostre","historico","servico","manutencao","responsavel","por","em","e","que","houve"]);
  const tokens = q.replace(/\b\d+\b/g, " ").split(/[^a-z]+/).filter(x=>x.length > 2 && !stop.has(x));
  return records.filter(r => {
    if (prefix && r.prefix !== prefix) return false;
    if (!tokens.length) return !!prefix;
    const haystack = normalize([r.part,r.notes,r.workOrder].filter(Boolean).join(" "));
    return tokens.every(t => haystack.includes(t));
  }).sort((a,b) => b.date.localeCompare(a.date));
}

export function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}
