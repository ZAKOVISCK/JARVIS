import { integer, sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";

// Append-only query snapshots. Idempotency is scoped to the authenticated owner.
export const queryHistory = sqliteTable("query_history", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  runId: text("run_id").notNull(),
  itemKey: text("item_key").notNull(),
  requestHash: text("request_hash").notNull(),
  createdAt: text("created_at").notNull(),
  prefix: text("prefix").notNull(),
  part: text("part").notNull(),
  searchText: text("search_text").notNull(),
  status: text("status").notNull(),
  sourceMode: text("source_mode").notNull(),
  snapshot: text("snapshot").notNull(),
},table=>[
  uniqueIndex("idx_queries_owner_run_item").on(table.ownerId,table.runId,table.itemKey),
  index("idx_queries_owner_created").on(table.ownerId,table.createdAt,table.id),
  index("idx_queries_owner_prefix_created").on(table.ownerId,table.prefix,table.createdAt),
  index("idx_queries_owner_status_created").on(table.ownerId,table.status,table.createdAt),
]);

export const importJobs = sqliteTable("import_jobs", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileHash: text("file_hash"),
  columnMapping: text("column_mapping"),
  cancelledAt: text("cancelled_at"),
  status: text("status").notNull(),
  totalRows: integer("total_rows").notNull(),
  acceptedRows: integer("accepted_rows").notNull(),
  duplicateRows: integer("duplicate_rows").notNull(),
  quarantineRows: integer("quarantine_rows").notNull(),
  createdAt: text("created_at").notNull(),
  integratedAt: text("integrated_at"),
  rolledBackAt: text("rolled_back_at"),
}, (table) => [index("idx_import_jobs_owner_created").on(table.ownerId, table.createdAt)]);

export const importRows = sqliteTable("import_rows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: text("job_id").notNull(),
  ownerId: text("owner_id").notNull(),
  rowNumber: integer("row_number").notNull(),
  payload: text("payload").notNull(),
  status: text("status").notNull(),
  reason: text("reason"),
  dedupeKey: text("dedupe_key"),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_import_rows_owner_job").on(table.ownerId, table.jobId), index("idx_import_rows_job_status").on(table.jobId, table.status)]);

export const maintenance = sqliteTable("maintenance", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: text("owner_id").notNull(),
  prefix: text("prefix").notNull(),
  part: text("part").notNull(),
  date: text("date").notNull(),
  km: integer("km"),
  mechanic: text("mechanic"),
  workOrder: text("work_order"),
  source: text("source").notNull(),
  notes: text("notes"),
  importJobId: text("import_job_id"),
  recordKey: text("record_key"),
  sourceRecordId: text("source_record_id"),
  movementType: text("movement_type"),
  quantity: integer("quantity"),
  movementEvidence: text("movement_evidence"),
  sourceLine: integer("source_line"),
  sourceFile: text("source_file"),
  time: text("time"),
}, (table) => [
  index("idx_maintenance_owner_prefix").on(table.ownerId, table.prefix),
  uniqueIndex("idx_maintenance_owner_record_key").on(table.ownerId, table.recordKey),
  index("idx_maintenance_owner_source_record").on(table.ownerId, table.sourceRecordId),
]);

export const auditEvents=sqliteTable("audit_events",{id:text("id").primaryKey(),ownerId:text("owner_id").notNull(),subjectId:text("subject_id").notNull(),kind:text("kind").notNull(),actor:text("actor").notNull(),createdAt:text("created_at").notNull(),payload:text("payload").notNull()},t=>[index("idx_audit_owner_subject").on(t.ownerId,t.subjectId,t.createdAt),index("idx_audit_owner_created").on(t.ownerId,t.createdAt)]);
