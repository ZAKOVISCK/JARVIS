import {copyFileSync, existsSync, mkdirSync, readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const tesseract = dirname(require.resolve('tesseract.js/package.json'));
// Resolve the transitive core from its own dependency owner under pnpm.
const dependencyRequire = createRequire(join(tesseract,'package.json'));
const core = dirname(dependencyRequire.resolve('tesseract.js-core/package.json'));
const language = dirname(require.resolve('@tesseract.js-data/por/package.json'));
const output = fileURLToPath(new URL('../public/ocr/', import.meta.url));
mkdirSync(join(output,'core'),{recursive:true});
mkdirSync(join(output,'lang'),{recursive:true});
for (const name of readdirSync(core).filter(name=>/^tesseract-core.*\.wasm\.js$/.test(name))) copyFileSync(join(core,name),join(output,'core',name));
copyFileSync(join(tesseract,'dist/worker.min.js'),join(output,'worker.min.js'));
const languageFiles = ['4.0.0_best_int/por.traineddata.gz','4.0.0/por.traineddata.gz','4.0.0_fast/por.traineddata.gz'];
const trained = languageFiles.map(name=>join(language,name)).find(existsSync);
if (!trained) throw new Error('Dados OCR em português não encontrados na dependência fixada.');
copyFileSync(trained,join(output,'lang/por.traineddata.gz'));
console.log('Recursos OCR preparados a partir das dependências fixadas. Não há download em tempo de uso.');
