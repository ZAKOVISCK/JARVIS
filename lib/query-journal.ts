import {normalize} from "./fleet.ts";
import type {SearchSnapshot} from "./validated-search.ts";

export const INSERT_SNAPSHOT=`INSERT INTO query_history
 (id,owner_id,run_id,item_key,request_hash,created_at,prefix,part,search_text,status,source_mode,snapshot)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,run_id,item_key) DO NOTHING`;
export function snapshotValues(owner:string,hash:string,s:SearchSnapshot){return [s.id,owner,s.runId,s.itemKey,hash,s.queriedAt,s.prefix,s.resolvedPart,normalize([s.prefix,s.part,s.resolvedPart,s.query,s.latest?.document||""].join(" ")),s.status,s.sourceMode,JSON.stringify(s)];}
export async function digest(value:string){const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,"0")).join("");}
export async function saveSnapshots(db:D1Database,owner:string,hashes:Map<string,string>,snapshots:SearchSnapshot[]){
 if(!snapshots.length)return;
 await db.batch(snapshots.map(s=>db.prepare(INSERT_SNAPSHOT).bind(...snapshotValues(owner,hashes.get(s.itemKey)!,s))));
}
