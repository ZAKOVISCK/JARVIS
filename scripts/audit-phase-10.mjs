import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve("public/data");
const today = new Date().toISOString().slice(0, 10);
const summary = JSON.parse(fs.readFileSync(path.join(dataDir, "summary.json"), "utf8"));
const catalog = JSON.parse(fs.readFileSync(path.join(dataDir, "catalog.json"), "utf8"));
const files = fs.readdirSync(dataDir).filter(file => /^\d+\.json$/.test(file));
const result = {
  generatedAt: new Date().toISOString(),
  vehicles: files.length,
  parts: 0,
  services: 0,
  invalidPrefixes: 0,
  invalidDates: 0,
  futureDates: 0,
  missingPartDescriptions: 0,
  emptyServiceRows: 0,
  negativeStockMovements: 0,
  movements: { issues: 0, returns: 0, reversals: 0, adjustments: 0 },
  probablePartDuplicateGroups: 0,
  probablePartDuplicateExcess: 0,
  probableDuplicateSamples: [],
  probableServiceDuplicateGroups: 0,
  probableServiceDuplicateExcess: 0,
  duplicateCatalogCodes: 0,
  duplicateStandardizedIds: 0,
  countMismatches: [],
  status: "approved",
};

for (const file of files) {
  const vehicle = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
  const prefix = Number(vehicle.code);
  if (!Number.isInteger(prefix) || prefix < 1 || prefix > 559) result.invalidPrefixes++;
  const positiveMovements = new Set(vehicle.parts.filter(row=>row[4]!==null&&row[4]>0).map(row=>JSON.stringify([row[0],row[1],row[3],Math.abs(row[4])])));
  const partKeys = new Map();
  const serviceKeys = new Map();
  for (const row of vehicle.parts) {
    result.parts++;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row[0])) result.invalidDates++;
    else if (row[0] > today) result.futureDates++;
    if (!row[3]) result.missingPartDescriptions++;
    if (row[4] !== null && row[4] < 0) {
      result.negativeStockMovements++;
      const movementKey=JSON.stringify([row[0],row[1],row[3],Math.abs(row[4])]);
      if(positiveMovements.has(movementKey))result.movements.reversals++;
      else result.movements.returns++;
    } else if(row[4]===0) result.movements.adjustments++;
    else result.movements.issues++;
    const key = JSON.stringify([row[0], row[1], row[2], row[3], row[4], row[5], row[7]]);
    const duplicate=partKeys.get(key)||{count:0,positions:[],row};duplicate.count++;duplicate.positions.push(row[6]);partKeys.set(key,duplicate);
  }
  for (const item of partKeys.values()) if (item.count > 1) {
    result.probablePartDuplicateGroups++; result.probablePartDuplicateExcess += item.count - 1;
    if(result.probableDuplicateSamples.length<24)result.probableDuplicateSamples.push({prefix:`55${String(prefix).padStart(3,"0")}`,date:item.row[0],workOrder:item.row[1]||null,part:item.row[3],quantity:item.row[4],occurrences:item.count,sourceIds:item.positions.map(position=>`EXT-${String(position).padStart(7,"0")}`)});
  }
  for (const row of vehicle.services) {
    result.services++;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row[0])) result.invalidDates++;
    else if (row[0] > today) result.futureDates++;
    if (!row[1] && !row[3] && !row[5]) result.emptyServiceRows++;
    const key = JSON.stringify([row[0], row[1], row[2], row[3], row[4], row[5], row[7]]);
    serviceKeys.set(key, (serviceKeys.get(key) || 0) + 1);
  }
  for (const count of serviceKeys.values()) if (count > 1) { result.probableServiceDuplicateGroups++; result.probableServiceDuplicateExcess += count - 1; }
}

const catalogCodes = new Set();
for (const material of catalog.materials) {
  if (catalogCodes.has(material.code)) result.duplicateCatalogCodes++;
  catalogCodes.add(material.code);
}
const standardizedIds = new Set();
for (const part of catalog.standardizedParts) {
  if (standardizedIds.has(part.id)) result.duplicateStandardizedIds++;
  standardizedIds.add(part.id);
}
if (summary.fleet.length !== result.vehicles) result.countMismatches.push(`Frota: resumo ${summary.fleet.length}, arquivos ${result.vehicles}`);
if (summary.counts.p !== result.parts) result.countMismatches.push(`Peças: resumo ${summary.counts.p}, arquivos ${result.parts}`);
if (summary.counts.s !== result.services) result.countMismatches.push(`Serviços: resumo ${summary.counts.s}, arquivos ${result.services}`);
const critical = result.invalidPrefixes + result.invalidDates + result.futureDates + result.missingPartDescriptions + result.emptyServiceRows + result.duplicateCatalogCodes + result.duplicateStandardizedIds + result.countMismatches.length;
if (critical) result.status = "rejected";

console.log(JSON.stringify(result, null, 2));
fs.writeFileSync(path.join(dataDir,"admin-audit.json"),`${JSON.stringify({...result,classificationMethod:"Classificação por regra: a fonte não informa a natureza do movimento. Estorno provável: negativo com saída positiva na mesma data, O.S., peça e quantidade absoluta. Os demais negativos são agrupados como devoluções para conferência. Confirme a natureza no documento original."},null,2)}\n`);
if (critical) process.exitCode = 1;
