import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb,getRawDb } from "@/db";
import { importJobs, importRows, auditEvents } from "@/db/schema";
import { validateImportRow, type ImportRawRow,parseImportCsv,type ColumnMapping } from "@/lib/import-pipeline";
import {findDuplicateKeys} from '@/lib/import-deduplication';

import {digest} from "@/lib/query-journal";
import {readLimitedText,BodyLimitError} from "@/lib/request-body";
export const dynamic = "force-dynamic";
const getOwner = (request: NextRequest) => request.headers.get("oai-authenticated-user-id");
const chunk = <T,>(rows: T[], size = 30) => Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, (index + 1) * size));

export async function GET(request: NextRequest) {
  const owner = getOwner(request);
  if (!owner) return NextResponse.json({ error: "Acesso autenticado necessário." }, { status: 401 });
  try {
    const jobs = await getDb().select().from(importJobs).where(eq(importJobs.ownerId, owner)).orderBy(desc(importJobs.createdAt)).limit(8);
    return NextResponse.json({ jobs },{headers:{"Cache-Control":"no-store"}});
  } catch (error) {
    console.error("Import history failed", error);
    return NextResponse.json({ error: "Não foi possível carregar o histórico de importações." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const owner = getOwner(request);
  if (!owner) return NextResponse.json({ error: "Acesso autenticado necessário." }, { status: 401 });
  try {
    const raw=await readLimitedText(request,8*1024*1024),payload=JSON.parse(raw) as {fileName?:unknown;rows?:unknown;content?:unknown;mapping?:ColumnMapping};
    let fileHash:string|null=null,columnMapping:string|null=null;
    if(typeof payload.content==='string'){if(new TextEncoder().encode(payload.content).byteLength>4*1024*1024)throw new BodyLimitError('CSV acima de 4 MB.');if(typeof payload.fileName!=='string'||!payload.fileName.toLowerCase().endsWith('.csv'))throw new TypeError('Use arquivo CSV.');fileHash=await digest(payload.content);columnMapping=JSON.stringify(payload.mapping||{});try{payload.rows=parseImportCsv(payload.content,payload.mapping)}catch(e){throw new TypeError(e instanceof Error?e.message:'CSV inválido.')}}else if(new TextEncoder().encode(raw).byteLength>4*1024*1024)throw new BodyLimitError('Dados acima de 4 MB.');
    if (typeof payload.fileName !== "string" || !payload.fileName.trim()) return NextResponse.json({ error: "Nome do arquivo inválido." }, { status: 400 });
    const fileName = payload.fileName.trim();
    if(fileName.length>180)throw new TypeError('O nome do arquivo excede 180 caracteres. Renomeie o arquivo antes de importar.');
    if (!Array.isArray(payload.rows) || payload.rows.length < 1 || payload.rows.length > 1000) return NextResponse.json({ error: "Envie entre 1 e 1.000 linhas por importação." }, { status: 400 });
    const positions=new Set<number>();
    const rawRows: ImportRawRow[] = payload.rows.map((value, index) => {
      if (!value || typeof value !== "object") throw new Error(`Linha ${index + 2} inválida.`);
      const row = value as Record<string, unknown>;
      const text = (field: string, max = 500) => {if(typeof row[field]!=="string")return "";const value=String(row[field]).trim();if(value.length>max)throw new TypeError(`Linha ${index+2}: o campo ${field} excede ${max} caracteres. Revise o conteúdo.`);return value;};
      if(row.rowNumber!==undefined&&(!Number.isSafeInteger(row.rowNumber)||Number(row.rowNumber)<1))throw new TypeError(`Linha ${index+2}: posição na planilha inválida. Revise a origem.`);
      const rowNumber=row.rowNumber===undefined?index+2:Number(row.rowNumber);
      if(positions.has(rowNumber))throw new TypeError(`Posição na planilha ${rowNumber} repetida. Revise as linhas antes de importar.`);
      positions.add(rowNumber);
      const fileKey=fileName.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").slice(0,60).toUpperCase()||"PLANILHA";
      return { rowNumber, sourceRecordId: text("sourceRecordId", 120)||`AUTO-${fileKey}-L${rowNumber}`, prefix: text("prefix", 30), part: text("part"), date: text("date", 30), quantity: text("quantity", 40), movementType: text("movementType", 80), km: text("km", 40), mechanic: text("mechanic"), workOrder: text("workOrder", 120), source: text("source"), notes: text("notes", 1000), time:text("time",20) };
    });

    const db = getDb();
    const validations=rawRows.map(validateImportRow);
    const seen=await findDuplicateKeys(getRawDb(),owner,validations.flatMap(v=>v.status==='accepted'?[v.candidate]:[]));
    const createdAt = new Date().toISOString();
    const id = crypto.randomUUID();
    let acceptedRows = 0, duplicateRows = 0, quarantineRows = 0;
    const staged = rawRows.map((row,index) => {
      const validation = validations[index];
      if (validation.status === "quarantine") {
        quarantineRows++;
        return { jobId: id, ownerId: owner, rowNumber: row.rowNumber, payload: JSON.stringify(row), status: "quarantine", reason: validation.reason, dedupeKey: null, createdAt };
      }
      validation.candidate.sourceFile=fileName;
      if (seen.has(validation.key)) {
        duplicateRows++;
        return { jobId: id, ownerId: owner, rowNumber: row.rowNumber, payload: JSON.stringify(validation.candidate), status: "duplicate", reason: "Registro já existente na base ou repetido neste arquivo.", dedupeKey: validation.key, createdAt };
      }
      seen.add(validation.key); acceptedRows++;
      return { jobId: id, ownerId: owner, rowNumber: row.rowNumber, payload: JSON.stringify(validation.candidate), status: "accepted", reason: null, dedupeKey: validation.key, createdAt };
    });
    const totalRows = staged.length;
    const jobInsert = db.insert(importJobs).values({ id, ownerId: owner, fileName, fileType: "csv", fileHash,columnMapping,status: "review", totalRows, acceptedRows, duplicateRows, quarantineRows, createdAt, integratedAt: null, rolledBackAt: null });
    const rowInserts = chunk(staged, 10).map(group => db.insert(importRows).values(group));
    await db.batch([jobInsert, ...rowInserts, db.insert(auditEvents).values({id:crypto.randomUUID(),ownerId:owner,subjectId:id,kind:"import_review",actor:owner,createdAt,payload:JSON.stringify({fileName,fileHash,totalRows,acceptedRows,duplicateRows,quarantineRows})})]);
    const quarantine = staged.filter(row => row.status === "quarantine").slice(0, 12).map(row => ({ rowNumber: row.rowNumber, reason: row.reason }));
    const validRows = staged.filter(row => row.status !== "quarantine").map(row => ({...row,candidate:JSON.parse(row.payload) as import("@/lib/import-pipeline").ImportCandidate}));
    const movements = validRows.reduce<Record<string,number>>((acc,row)=>{const type=row.candidate.movementEvidence==="explicit"?row.candidate.movementType||"unknown":"unknown";acc[type]=(acc[type]||0)+1;return acc;},{issue:0,return:0,reversal:0,entry:0,adjustment:0});
    const identifiers={provided:validRows.filter(row=>row.candidate.sourceRecordId&&!row.candidate.sourceRecordId.startsWith("AUTO-")).length,generated:validRows.filter(row=>row.candidate.sourceRecordId?.startsWith("AUTO-")).length};
    const duplicates = validRows.filter(row=>row.status==="duplicate").slice(0,20).map(row=>({rowNumber:row.rowNumber,sourceRecordId:row.candidate.sourceRecordId||null,prefix:row.candidate.prefix,part:row.candidate.part,reason:row.reason}));
    return NextResponse.json({ job: { id, fileName: payload.fileName.trim(), fileHash,columnMapping,status: "review", totalRows, acceptedRows, duplicateRows, quarantineRows, createdAt }, quarantine, report:{movements,duplicates,identifiers} }, { status: 201 });
  } catch (error) {
    if(error instanceof BodyLimitError)return NextResponse.json({error:error.message},{status:413});
    if(error instanceof TypeError)return NextResponse.json({error:error.message},{status:400});
    if (error instanceof SyntaxError || (error instanceof Error && /^Linha \d+ inválida/.test(error.message))) return NextResponse.json({ error: error instanceof Error ? error.message : "Dados inválidos." }, { status: 400 });
    console.error("Import staging failed", error);
    return NextResponse.json({ error: "Não foi possível preparar a importação. Nenhum registro foi integrado." }, { status: 503 });
  }
}
