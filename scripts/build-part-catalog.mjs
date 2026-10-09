import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dataDirectory = path.join(root, "public", "data");

const familyDisplayNames = new Map(Object.entries({
  "Cambio": "Câmbio",
  "Eletrica": "Elétrica",
  "Eixo Dianteiro/Direcao": "Eixo Dianteiro/Direção",
  "Graxas": "Graxas",
  "Parafusos/Conexoes/Abracadeira": "Parafusos/Conexões/Abraçadeiras",
  "Pecas Borracharia": "Peças de Borracharia",
  "Pecas Para Arla": "Peças para ARLA",
  "Pecas Preventiva": "Peças Preventivas",
  "Pneumatica": "Pneumática",
  "Produto De Limpeza": "Produtos de Limpeza",
  "Servico Terceiros": "Serviços de Terceiros",
  "Sistema Hidraulico": "Sistema Hidráulico",
  "Suspensao": "Suspensão",
  "Onibus Eletrico": "Ônibus Elétrico",
  "Material De Escritorio": "Material de Escritório",
  "Produtos Alimenticios": "Produtos Alimentícios",
  "Ferramentas/Equipamentos": "Ferramentas e Equipamentos",
  "Uniforme/Epi/Sgi": "Uniforme/EPI/SGI",
}));

const aliasRules = [
  { test: /^(?:BI[ -]?TURBO|BITURBO|TURBO|TURBINA)\b/, aliases: ["turbina", "turbo", "biturbo", "bi turbo"] },
  { test: /^BICOS? INJETOR(?:ES)?\b/, aliases: ["bico injetor", "bicos injetores", "injetor", "injetores"] },
  { test: /^(?:CAMBIO|CAIXA (?:DE )?CAMBIO)\b/, aliases: ["câmbio", "cambio", "caixa de câmbio", "caixa de cambio"] },
  { test: /KIT (?:DE )?EMBREAGEM\b/, aliases: ["kit de embreagem", "kit embreagem", "embreagem"] },
  { test: /CILINDRO MESTRE.*EMBREAGEM|CILINDRO MESTRE EMBREAGEM/, aliases: ["cilindro mestre", "cilindro mestre da embreagem"] },
  { test: /SERVO.*EMBREAGEM/, aliases: ["servo de embreagem", "servo embreagem"] },
  { test: /^OLEO (?:DO )?MOTOR\b/, aliases: ["óleo do motor", "oleo do motor", "óleo motor", "oleo motor"] },
  { test: /^OLEO (?:DO |DE )?CAMBIO\b/, aliases: ["óleo do câmbio", "oleo do cambio", "óleo câmbio", "oleo cambio"] },
  { test: /^OLEO (?:DO |DE )?DIFERENCIAL\b/, aliases: ["óleo do diferencial", "oleo do diferencial", "óleo diferencial", "oleo diferencial"] },
  { test: /^FILTRO (?:DE |DO )?(?:DIESEL|COMBUSTIVEL)\b/, aliases: ["filtro de diesel", "filtro diesel", "filtro de combustível", "filtro combustivel"] },
  { test: /^FILTRO (?:DE |DO )?AR\b/, aliases: ["filtro de ar", "filtro ar"] },
  { test: /^FILTRO (?:DE |DO )?OLEO\b/, aliases: ["filtro de óleo", "filtro de oleo", "filtro óleo", "filtro oleo"] },
];

// Fase 2 — vocabulário operacional aprovado. A identidade do material continua
// sendo família original + descrição + código; estes grupos apenas relacionam
// variações de estoque a uma peça-mãe pesquisável.
const standardizedParts = [
  { id: "bico-injetor", name: "Bico Injetor", families: ["Motor"], aliases: ["bico injetor", "bicos injetores", "caneta injetora", "unidade injetora"], test: /^(?:BICOS? INJETOR(?:ES)?|CANETA BICO INJETOR|UNIDADE INJETORA)\b/ },
  { id: "bi-turbo-turbina", name: "Bi turbo/Turbina", families: ["Motor"], aliases: ["bi turbo", "biturbo", "turbo", "turbina"], test: /^(?:BI[ -]?TURBO|BITURBO|TURBO|TURBINA)\b/ },
  { id: "bloco", name: "Bloco", families: ["Motor"], aliases: ["bloco", "bloco do motor", "bloco motor"], test: /^BLOCO (?:DO )?MOTOR\b/ },
  { id: "bomba-injetora-cp3", name: "Bomba Injetora/Bomba CP3", families: ["Motor"], aliases: ["bomba injetora", "bomba cp3", "cp3", "bomba de alta pressão"], test: /^BOMBA (?:CP3|INJETORA|(?:DE )?ALTA PRESSAO CP3)\b/ },
  { id: "bomba-oleo", name: "Bomba de Óleo", families: ["Motor"], aliases: ["bomba de óleo", "bomba oleo", "bomba do óleo"], test: /^BOMBA (?:DE |DO )?OLEO\b/ },
  { id: "bomba-agua", name: "Bomba D'Água", families: ["Motor", "Arrefecimento"], aliases: ["bomba d'água", "bomba dagua", "bomba de água", "bomba agua"], test: /^BOMBA (?:D['’]?|DE )?AGUA\b/ },
  { id: "intercooler", name: "Intercooler", families: ["Motor", "Arrefecimento"], aliases: ["intercooler", "inter cooler"], test: /^INTER[ -]?COOLER\b/ },
  { id: "kit-motor", name: "Kit Motor", families: ["Motor"], aliases: ["kit motor", "kit do motor"], test: /^KIT (?:DO )?MOTOR\b/ },
  { id: "motor-parcial", name: "Motor Parcial", families: ["Motor"], aliases: ["motor parcial"], test: /^MOTOR PARCIAL\b/ },
  { id: "motor-completo", name: "Motor Completo", families: ["Motor"], aliases: ["motor completo"], test: /^MOTOR(?! COM BOMBA).*\bCOMPLETO\b/ },
  { id: "cambio", name: "Câmbio", families: ["Câmbio e Embreagem"], aliases: ["câmbio", "cambio", "caixa de câmbio", "caixa de cambio"], test: /^CAMBIO\b/ },
  { id: "kit-embreagem", name: "Kit de Embreagem", families: ["Câmbio e Embreagem"], aliases: ["kit de embreagem", "kit embreagem", "embreagem"], test: /^KIT (?:DE )?EMBREAGEM\b/ },
  { id: "servo-embreagem", name: "Servo de Embreagem", families: ["Câmbio e Embreagem"], aliases: ["servo de embreagem", "servo embreagem"], test: /^SERVO (?:DE )?EMBREAGEM\b/ },
  { id: "cilindro-mestre", name: "Cilindro Mestre", families: ["Câmbio e Embreagem"], aliases: ["cilindro mestre", "cilindro mestre da embreagem"], test: /^CILINDRO MESTRE(?:\s+EMBREAGEM|\b)/ },
  { id: "radiador", name: "Radiador", families: ["Arrefecimento"], aliases: ["radiador", "radiador de água"], test: /^RADIADOR(?!.*\b(?:OLEO|LIMPEZA)\b).*\b/ },
  { id: "reservatorio", name: "Reservatório", families: ["Arrefecimento"], aliases: ["reservatório", "reservatorio", "reservatório de água"], test: /^RESERVATORIO (?:DE )?AGUA\b/ },
  { id: "ventoinha-embreagem-viscosa", name: "Conjunto da Ventoinha/Embreagem Viscosa", families: ["Arrefecimento"], aliases: ["conjunto da ventoinha", "ventoinha", "hélice do radiador", "embreagem viscosa"], test: /^(?:EMBREAGEM VISCOSA|HELICE RADIADOR)\b/ },
  { id: "valvula-termostatica", name: "Válvula Termostática", families: ["Arrefecimento"], aliases: ["válvula termostática", "valvula termostatica"], test: /^VALVULA TERMOSTATICA\b/ },
  { id: "oleo-cambio", name: "Óleo de Câmbio", families: ["Lubrificação"], aliases: ["óleo de câmbio", "óleo do câmbio", "oleo cambio"], test: /^OLEO (?:DE |DO )?CAMBIO\b/ },
  { id: "oleo-diferencial", name: "Óleo Diferencial", families: ["Lubrificação"], aliases: ["óleo diferencial", "óleo do diferencial", "oleo diferencial"], test: /^OLEO (?:DE |DO )?DIFERENCIAL\b/ },
  { id: "oleo-motor", name: "Óleo Motor", families: ["Lubrificação"], aliases: ["óleo motor", "óleo do motor", "oleo motor"], test: /^OLEO (?:DE |DO )?MOTOR(?!.*\b(?:COMPSOR|COMPRESSOR)\b).*\b/ },
  { id: "filtro-ar", name: "Filtro de Ar", families: ["Lubrificação"], aliases: ["filtro de ar", "filtro ar"], test: /^FILTRO (?:DE )?AR(?:\s+(?!CONDICIONADO\b|CABINE\b).*)?$/ },
  { id: "filtro-diesel", name: "Filtro de Diesel", families: ["Lubrificação"], aliases: ["filtro de diesel", "filtro diesel", "filtro de combustível", "filtro combustivel"], test: /^(?:(?:CONJUNTO )?FILTRO (?:DE )?(?:DIESEL|COMBUSTIVEL)|FILTRO RACOR DIESEL)\b/ },
  { id: "filtro-oleo", name: "Filtro de Óleo", families: ["Lubrificação"], aliases: ["filtro de óleo", "filtro oleo"], test: /^FILTRO (?:DE )?OLEO\b/ },
];

const consumableFamilies = new Set([
  "Combustivel", "Filtros", "Graxas", "Lubrificacao", "Material De Escritorio",
  "Pecas Para Arla", "Produto De Limpeza", "Produtos Alimenticios", "Uniforme/Epi/Sgi",
]);
const accessoryStart = /^(?:ABRACADEIRA|ANEL|ARRUELA|BUCHA|CANO|CHICOTE|CONECTOR|CONEXAO|FLEXIVEL|JUNTA|MANGUEIRA|PARAFUSO|PORCA|PRISIONEIRO|RETENTOR|SUPORTE|TAMPAO?|TERMINAL|TRAVA|TUBO)\b/;
const consumableStart = /^(?:ADITIVO|ARLA|COLA|DESENGRIPANTE|ESTOPA|FLUIDO|FILTRO|GRAXA|LIXA|OLEO|SILICONE|SOLVENTE|TINTA)\b/;

function splitMaterial(original) {
  const match = original.match(/^(.*?)\s(\d{4,6})$/);
  if (!match) throw new Error(`Material sem código final: ${original}`);
  return { canonical: match[1].trim(), code: match[2] };
}

function classify(family, canonical) {
  if (family === "Servico Terceiros" || /^SERVICO\b/.test(canonical)) return "servico";
  if (consumableFamilies.has(family) || consumableStart.test(canonical)) return "consumivel";
  if (accessoryStart.test(canonical)) return "acessorio";
  return "componente";
}

function aliasesFor(canonical) {
  const aliases = new Set();
  for (const rule of aliasRules) if (rule.test.test(canonical)) rule.aliases.forEach(alias => aliases.add(alias));
  return [...aliases].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function standardizedPartFor(canonical) {
  const matches = standardizedParts.filter(part => part.test.test(canonical));
  if (matches.length > 1) throw new Error(`Material pertence a mais de uma peça-mãe: ${canonical}`);
  return matches[0];
}

const files = (await readdir(dataDirectory)).filter(name => /^\d+\.json$/.test(name));
const materials = new Map();

for (const file of files) {
  const vehicle = JSON.parse(await readFile(path.join(dataDirectory, file), "utf8"));
  for (const row of vehicle.parts ?? []) {
    const original = String(row[3] ?? "").trim();
    const family = String(row[7] || "Sem família informada").trim();
    if (!original) continue;
    const { canonical, code } = splitMaterial(original);
    const previous = materials.get(code);
    if (previous && (previous.original !== original || previous.family !== family)) {
      throw new Error(`Código ${code} possui identidades conflitantes.`);
    }
    const standardized = standardizedPartFor(canonical);
    const item = previous ?? {
      code,
      original,
      canonical,
      family,
      familyDisplay: familyDisplayNames.get(family) ?? family,
      kind: classify(family, canonical),
      aliases: [...new Set([...aliasesFor(canonical), ...(standardized?.aliases ?? [])])].sort((a, b) => a.localeCompare(b, "pt-BR")),
      standardizedPartId: standardized?.id ?? null,
      records: 0,
      positiveRecords: 0,
    };
    item.records += 1;
    if (row[4] === null || Number(row[4]) > 0) item.positiveRecords += 1;
    materials.set(code, item);
  }
}

const sorted = [...materials.values()].sort((a, b) =>
  a.familyDisplay.localeCompare(b.familyDisplay, "pt-BR") ||
  a.canonical.localeCompare(b.canonical, "pt-BR") ||
  a.code.localeCompare(b.code, "pt-BR")
);
const aliases = new Set(sorted.flatMap(item => item.aliases));
const standardizedCatalog = standardizedParts.map(part => {
  const members = sorted.filter(item => item.standardizedPartId === part.id);
  if (!members.length) throw new Error(`Peça-mãe sem materiais associados: ${part.name}`);
  return {
    id: part.id,
    name: part.name,
    families: part.families,
    aliases: part.aliases,
    codes: members.map(item => item.code),
    materials: members.length,
    records: members.reduce((total, item) => total + item.records, 0),
    positiveRecords: members.reduce((total, item) => total + item.positiveRecords, 0),
  };
});
const output = {
  version: 2,
  identity: "family+canonical+code",
  stats: {
    families: new Set(sorted.map(item => item.family)).size,
    materials: sorted.length,
    materialsWithPositiveMovement: sorted.filter(item => item.positiveRecords > 0).length,
    aliases: aliases.size,
    movements: sorted.reduce((total, item) => total + item.records, 0),
    standardizedFamilies: new Set(standardizedCatalog.flatMap(item => item.families)).size,
    standardizedParts: standardizedCatalog.length,
    standardizedMaterials: sorted.filter(item => item.standardizedPartId).length,
  },
  standardizedParts: standardizedCatalog,
  materials: sorted,
};

await writeFile(path.join(dataDirectory, "catalog.json"), JSON.stringify(output), "utf8");
console.log(JSON.stringify(output.stats));
