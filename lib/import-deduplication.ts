import {importRowKey,type ImportCandidate} from './import-pipeline.ts';
type Existing=Omit<ImportCandidate,'movementType'|'movementEvidence'|'sourceLine'|'sourceFile'>&{id:number;movementType:string|null};

/** Scan only candidate prefix/date pairs in bounded pages, including legacy keys. */
export async function findDuplicateKeys(db:D1Database,owner:string,candidates:ImportCandidate[]){
 const wanted=new Set(candidates.map(importRowKey)),found=new Set<string>();
 const pairs=[...new Map(candidates.map(r=>[JSON.stringify([r.prefix,r.date]),[r.prefix,r.date]])).values()];
 for(let at=0;at<pairs.length;at+=30){
  const group=pairs.slice(at,at+30),where=group.map(()=>'(prefix=? AND date=?)').join(' OR ');let after=0;
  while(true){
   const rows=(await db.prepare(`SELECT id,prefix,part,date,km,mechanic,work_order AS workOrder,source,notes,source_record_id AS sourceRecordId,quantity,movement_type AS movementType,time FROM maintenance WHERE owner_id=? AND id>? AND (${where}) ORDER BY id LIMIT 1000`).bind(owner,after,...group.flat()).all<Existing>()).results;
   for(const row of rows){const key=importRowKey(row);if(wanted.has(key))found.add(key)}
   if(rows.length<1000)break;after=rows[rows.length-1].id;
  }
 }
 return found;
}
