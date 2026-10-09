import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { getDb,getRawDb } from "@/db";
import { importJobs, importRows } from "@/db/schema";
import { type ImportCandidate } from "@/lib/import-pipeline";

import {PUBLISH_IMPORT,RECONCILE_IMPORT,COMPLETE_IMPORT} from "@/lib/import-transaction";
import {readLimitedText,BodyLimitError} from "@/lib/request-body";
export const dynamic = "force-dynamic";
const getOwner = (request: NextRequest) => request.headers.get("oai-authenticated-user-id");

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const owner = getOwner(request);
  if (!owner) return NextResponse.json({ error: "Acesso autenticado necessário." }, { status: 401 });
  try {
    const { id } = await context.params;
    const db = getDb();
    const [job] = await db.select().from(importJobs).where(and(eq(importJobs.id, id), eq(importJobs.ownerId, owner))).limit(1);
    if (!job) return NextResponse.json({ error: "Versão de importação não encontrada." }, { status: 404 });
    const rows = await db.select({ rowNumber: importRows.rowNumber, reason: importRows.reason, status: importRows.status, payload: importRows.payload }).from(importRows).where(and(eq(importRows.jobId, id), eq(importRows.ownerId, owner))).orderBy(asc(importRows.rowNumber),asc(importRows.id));
    const quarantine = rows.filter(row=>row.status==="quarantine").slice(0,20).map(({rowNumber,reason})=>({rowNumber,reason}));
    const validRows = rows.filter(row=>row.status!=="quarantine").map(row=>({...row,candidate:JSON.parse(row.payload) as ImportCandidate}));
    const movements = validRows.reduce<Record<string,number>>((acc,row)=>{const type=row.candidate.movementEvidence==="explicit"?row.candidate.movementType||"unknown":"unknown";acc[type]=(acc[type]||0)+1;return acc;},{issue:0,return:0,reversal:0,entry:0,adjustment:0});
    const identifiers={provided:validRows.filter(row=>row.candidate.sourceRecordId&&!row.candidate.sourceRecordId.startsWith("AUTO-")).length,generated:validRows.filter(row=>row.candidate.sourceRecordId?.startsWith("AUTO-")).length};
    const duplicates = validRows.filter(row=>row.status==="duplicate").slice(0,20).map(row=>({rowNumber:row.rowNumber,sourceRecordId:row.candidate.sourceRecordId||null,prefix:row.candidate.prefix,part:row.candidate.part,reason:row.reason}));
    const events=(await getRawDb().prepare("SELECT kind,actor,created_at FROM audit_events WHERE owner_id=? AND subject_id=? ORDER BY created_at,id").bind(owner,id).all()).results;
    return NextResponse.json({ job, events, rows:rows.map(row=>({...row,payload:JSON.parse(row.payload)})), quarantine, report:{movements,duplicates,identifiers} },{headers:{"Cache-Control":"no-store"}});
  } catch (error) {
    console.error("Import details failed", error);
    return NextResponse.json({ error: "Não foi possível carregar os detalhes desta versão." }, { status: 503 });
  }
}

export async function POST(request:NextRequest,context:{params:Promise<{id:string}>}){
 const owner=getOwner(request);if(!owner)return NextResponse.json({error:"Acesso autenticado necessário."},{status:401});
 try{const {id}=await context.params,{action}=JSON.parse(await readLimitedText(request,2048));if(!['integrate','rollback','cancel'].includes(action))return NextResponse.json({error:'Ação inválida.'},{status:400});const db=getRawDb(),job=await db.prepare('SELECT * FROM import_jobs WHERE id=? AND owner_id=?').bind(id,owner).first<{status:string}>();if(!job)return NextResponse.json({error:'Versão não encontrada.'},{status:404});const expected=action==='rollback'?'integrated':'review';if(job.status!==expected)return NextResponse.json({error:'O estado desta versão não permite esta ação.'},{status:409});const now=new Date().toISOString(),audit=db.prepare('INSERT INTO audit_events(id,owner_id,subject_id,kind,actor,created_at,payload) SELECT ?,owner_id,id,?,owner_id,?,? FROM import_jobs WHERE id=? AND owner_id=? AND status=?').bind(crypto.randomUUID(),`import_${action}`,now,JSON.stringify({action}),id,owner,expected);
 if(action==='integrate')await db.batch([audit,db.prepare(PUBLISH_IMPORT).bind(id,owner),db.prepare(RECONCILE_IMPORT).bind(id,owner),db.prepare(COMPLETE_IMPORT).bind(now,id,owner)]);
 if(action==='cancel')await db.batch([audit,db.prepare("UPDATE import_jobs SET status='cancelled',cancelled_at=? WHERE id=? AND owner_id=? AND status='review'").bind(now,id,owner)]);
 if(action==='rollback')await db.batch([audit,db.prepare("DELETE FROM maintenance WHERE import_job_id=? AND owner_id=? AND EXISTS(SELECT 1 FROM import_jobs WHERE id=? AND owner_id=? AND status='integrated')").bind(id,owner,id,owner),db.prepare("UPDATE import_rows SET status='rolled_back' WHERE job_id=? AND owner_id=? AND status='integrated' AND EXISTS(SELECT 1 FROM import_jobs WHERE id=? AND owner_id=? AND status='integrated')").bind(id,owner,id,owner),db.prepare("UPDATE import_jobs SET status='rolled_back',rolled_back_at=? WHERE id=? AND owner_id=? AND status='integrated'").bind(now,id,owner)]);
 const updated=await db.prepare('SELECT status,accepted_rows FROM import_jobs WHERE id=? AND owner_id=?').bind(id,owner).first<{status:string;accepted_rows:number}>();return NextResponse.json({status:updated?.status,count:updated?.accepted_rows});
 }catch(e){return NextResponse.json({error:e instanceof BodyLimitError?'Solicitação acima do limite.':e instanceof SyntaxError?'Solicitação inválida.':'A transação não foi concluída. Consulte o estado da versão antes de tentar novamente.'},{status:e instanceof BodyLimitError?413:e instanceof SyntaxError?400:503})}
}
