import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/db";
import { maintenance } from "@/db/schema";

export const dynamic = "force-dynamic";
const getOwner = (request: NextRequest) => request.headers.get("oai-authenticated-user-id");

export async function GET(request: NextRequest) {
  const owner = getOwner(request);
  if (!owner) return NextResponse.json({ error: "Acesso autenticado necessário." }, { status: 401 });
  try {
    const requestedLimit=Number(request.nextUrl.searchParams.get("limit")||500),requestedOffset=Number(request.nextUrl.searchParams.get("offset")||0);
    const limit=Number.isInteger(requestedLimit)?Math.min(500,Math.max(1,requestedLimit)):500;
    const offset=Number.isSafeInteger(requestedOffset)?Math.max(0,requestedOffset):0;
    const rows = await getDb().select({id:maintenance.id,prefix:maintenance.prefix,part:maintenance.part,date:maintenance.date,km:maintenance.km,mechanic:maintenance.mechanic,workOrder:maintenance.workOrder,source:maintenance.source,notes:maintenance.notes,sourceRecordId:maintenance.sourceRecordId,movementType:maintenance.movementType,quantity:maintenance.quantity}).from(maintenance).where(eq(maintenance.ownerId, owner)).orderBy(desc(maintenance.date),desc(maintenance.id)).limit(limit).offset(offset);
    return NextResponse.json({ records: rows, nextOffset: rows.length===limit?offset+rows.length:null },{headers:{"Cache-Control":"no-store"}});
  } catch (error) {
    console.error("Maintenance list failed", error);
    return NextResponse.json({ error: "Não foi possível carregar os registros. Tente novamente." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const owner = getOwner(request);
  if (!owner) return NextResponse.json({ error: "Acesso autenticado necessário." }, { status: 401 });
  return NextResponse.json({ error: "A importação direta foi substituída pela área de preparação, conferência e aprovação." }, { status: 410 });
}
