import type { Maintenance } from "@/lib/maintenance";

export type ImportRawRow = {
  rowNumber: number;
  sourceRecordId: string;
  prefix: string;
  part: string;
  date: string;
  quantity: string;
  movementType: string;
  km: string;
  mechanic: string;
  workOrder: string;
  source: string;
  notes: string;
  time?: string;
};

export type ImportCandidate = Omit<Maintenance, "id">;
export type ImportValidation =
  | { status: "accepted"; candidate: ImportCandidate; key: string }
  | { status: "quarantine"; reason: string };

const fold = (value: string) => value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const keyText = (value: string | null) => (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
export const importAliases: Record<Exclude<keyof ImportRawRow, "rowNumber">, string[]> = {
  sourceRecordId: ["numreg", "documento", "identificador", "idregistro", "idmovimento", "idmovimentacao", "idlancamento", "codigolancamento", "registroorigem"],
  prefix: ["prefixo", "prefix", "carro"],
  part: ["peca", "part", "material", "descricao"],
  date: ["data", "date"],
  quantity: ["quantidade", "qtd", "saida", "movimento"],
  movementType: ["tipomovimento", "classificacao", "natureza", "operacao"],
  km: ["km", "quilometragem"],
  mechanic: ["responsavel", "mecanico", "mec", "func"],
  workOrder: ["os", "ordemdeservico", "ficha", "numeroos"],
  source: ["origem", "source", "fonte"],
  notes: ["observacao", "notes", "nota", "defeitoalegado"],
  time: ["hora", "horario", "horasaida"],
};

function parseCells(source: string, delimiter: string) {
  const rows: {cells:string[];line:number}[] = [];
  let row: string[] = [], field = "", quoted = false, line = 1, startLine = 1;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) { row.push(field.trim()); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push({cells:row,line:startLine});
      line++;startLine=line;row = []; field = "";
    } else {field += char;if(char==="\n")line++;}
  }
  if (quoted) throw new Error("Há aspas não fechadas no CSV.");
  row.push(field.trim());
  if (row.some(Boolean)) rows.push({cells:row,line:startLine});
  return rows;
}

export type ColumnMapping=Partial<Record<Exclude<keyof ImportRawRow,"rowNumber">,number>>;
export function inspectImportCsv(content:string){const source=content.replace(/^\uFEFF/,"");if(!source.trim())throw new Error("Arquivo vazio.");const first=source.split(/\r?\n/).find(l=>l.trim())||"",delimiter=(first.match(/;/g)?.length||0)>=(first.match(/,/g)?.length||0)?";":",";const rows=parseCells(source,delimiter),headers=rows.shift()?.cells;if(!headers||!rows.length||rows.length>1000)throw new Error("Inclua de 1 a 1.000 linhas por arquivo.");const mapping=Object.fromEntries(Object.entries(importAliases).map(([k,names])=>[k,headers.findIndex(h=>names.includes(fold(h)))])) as ColumnMapping;return {headers,samples:rows.slice(0,3).map(r=>r.cells),count:rows.length,mapping}}
export function parseImportCsv(content: string,mapping?:ColumnMapping): ImportRawRow[] {
  const source = content.replace(/^\uFEFF/, "");
  if (!source.trim()) throw new Error("O arquivo está vazio.");
  const first = source.split(/\r?\n/).find(line=>line.trim())||"";
  const delimiter = (first.match(/;/g)?.length || 0) >= (first.match(/,/g)?.length || 0) ? ";" : ",";
  const rows = parseCells(source, delimiter);
  const header = rows.shift()?.cells.map(fold);
  if (!header) throw new Error("O cabeçalho do CSV não foi encontrado.");
  const indexes = Object.fromEntries(Object.entries(importAliases).map(([field, names]) => [field, header.findIndex(value => names.includes(value))])) as Record<Exclude<keyof ImportRawRow, "rowNumber">, number>;
  if(mapping){const assigned:number[]=[];for(const field of Object.keys(importAliases) as (keyof typeof importAliases)[]){const value=mapping[field]??-1;if(!Number.isInteger(value)||value< -1||value>=header.length)throw new Error("Mapeamento inválido.");if(value>=0&&assigned.includes(value))throw new Error("Uma coluna não pode representar dois campos.");if(value>=0)assigned.push(value);indexes[field]=value;}}
  for (const field of ["prefix", "part", "date", "source"] as const) {
    if (indexes[field] < 0) throw new Error("Cabeçalho incompleto. São obrigatórias as colunas Prefixo, Peça, Data e Origem.");
  }
  if (!rows.length || rows.length > 1000) throw new Error("Inclua de 1 a 1.000 linhas por arquivo.");
  return rows.map(({cells,line}) => {
    const get = (field: Exclude<keyof ImportRawRow, "rowNumber">) => indexes[field] < 0 ? "" : (cells[indexes[field]] || "").trim();
    return { rowNumber: line, sourceRecordId: get("sourceRecordId"), prefix: get("prefix"), part: get("part"), date: get("date"), quantity: get("quantity"), movementType: get("movementType"), km: get("km"), mechanic: get("mechanic"), workOrder: get("workOrder"), source: get("source"), notes: get("notes"), time:get("time") };
  });
}

export function normalizeOperationalPrefix(value: string) {
  const digits = value.trim();
  if(!/^\d+$/.test(digits))return null;
  if (!digits) return null;
  const number = Number(digits);
  if (!Number.isInteger(number)) return null;
  if (digits.length === 5 && number >= 55001 && number <= 55559) return String(number);
  if (number >= 1 && number <= 559 && digits.length <= 3) return `55${String(number).padStart(3, "0")}`;
  return null;
}

function normalizeDate(value: string) {
  const raw = value.trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : /^\d{2}\/\d{2}\/\d{4}$/.test(raw) ? raw.split("/").reverse().join("-") : "";
  if (!iso) return null;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === iso ? iso : null;
}

export function importRowKey(row: Omit<ImportCandidate,"movementType"> & {movementType?:string|null}) {
  if (row.sourceRecordId && !row.sourceRecordId.startsWith("AUTO-")) return ["source-line", keyText(row.source), keyText(row.sourceRecordId), row.prefix, keyText(row.part), row.date, row.time||"", row.quantity??"", row.movementType||"unknown", keyText(row.workOrder)].join("\u001f");
  return [row.prefix, keyText(row.part), row.date, row.km ?? "", row.quantity ?? "", row.movementType ?? "issue", keyText(row.mechanic), keyText(row.workOrder), keyText(row.source), keyText(row.notes)].join("\u001f");
}

export function classifyMovement(value: string, quantity: number | null, notes = "") {
  const label=fold(value);
  if(["saida","issue"].includes(label))return "issue" as const;
  if(["devolucao","retorno","return"].includes(label))return "return" as const;
  if(["estorno","cancelamento","reversal"].includes(label))return "reversal" as const;
  if(["entrada","entry"].includes(label))return "entry" as const;
  if(["ajuste","adjustment"].includes(label))return "adjustment" as const;
  const explicit = fold(notes);
  if (explicit.includes("estorno") || explicit.includes("cancelamento")) return "reversal" as const;
  if (explicit.includes("devolucao") || explicit.includes("retorno")) return "return" as const;
  if (explicit.includes("entrada")) return "entry" as const;
  if (explicit.includes("ajuste") || quantity === 0) return "adjustment" as const;
  if (quantity !== null && quantity < 0) return "return" as const;
  return "unknown" as const;
}

export function validateImportRow(row: ImportRawRow): ImportValidation {
  const prefix = normalizeOperationalPrefix(row.prefix);
  if (!prefix) return { status: "quarantine", reason: "Prefixo fora da frota operacional (001 a 559 / 55001 a 55559)." };
  for(const [label,value,limit] of [['Peça',row.part,180],['Origem',row.source,180],['Identificador',row.sourceRecordId,120],['Responsável',row.mechanic,180],['O.S.',row.workOrder,60],['Observações',row.notes,500]] as const){if(value.trim().length>limit)return {status:'quarantine',reason:label+' excede '+limit+' caracteres. Revise o campo; ele não foi truncado.'}}
  const part = row.part.trim().slice(0, 180);
  if (!part) return { status: "quarantine", reason: "Peça ou descrição não informada." };
  const date = normalizeDate(row.date);
  if (!date) return { status: "quarantine", reason: "Data inválida; use DD/MM/AAAA ou AAAA-MM-DD." };
  const today = new Date();
  const localToday = new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(today);
  if (date > localToday) return { status: "quarantine", reason: "Data futura não permitida." };
  const source = row.source.trim().slice(0, 180);
  if (!source) return { status: "quarantine", reason: "Origem não informada." };
  const kmText = row.km.replace(/[.\s]/g, "").replace(",", ".");
  const km = kmText ? Number(kmText) : null;
  if (km !== null && (!Number.isInteger(km) || km < 0 || km > 9_999_999)) return { status: "quarantine", reason: "Quilometragem inválida." };
  const quantityText = row.quantity.replace(/[.\s]/g, "").replace(",", ".");
  const quantity = quantityText ? Number(quantityText) : null;
  if (quantity !== null && (!Number.isFinite(quantity) || Math.abs(quantity) > 1_000_000)) return { status: "quarantine", reason: "Quantidade inválida." };
  const notes = row.notes.trim().slice(0, 500) || null;
  const sourceRecordId = row.sourceRecordId.trim().slice(0, 120) || null;
  if(!Number.isSafeInteger(row.rowNumber)||row.rowNumber<1)return {status:'quarantine',reason:'Posição de origem inválida.'};
  const movementType = classifyMovement(row.movementType, quantity, `${source} ${notes || ""}`);
  const time=row.time?.trim()||null;
  if(time&&!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time))return {status:"quarantine",reason:"Horário inválido; use HH:MM ou HH:MM:SS."};
  const movementEvidence=["saida","issue","devolucao","retorno","return","estorno","cancelamento","reversal","entrada","entry","ajuste","adjustment"].includes(fold(row.movementType))?"explicit":"inferred";
  const candidate: ImportCandidate = { prefix, part, date, km, mechanic: row.mechanic.trim().slice(0, 180) || null, workOrder: row.workOrder.trim().slice(0, 60) || null, source, notes, sourceRecordId, movementType, quantity, movementEvidence, sourceLine:row.rowNumber, time };
  return { status: "accepted", candidate, key: importRowKey(candidate) };
}
