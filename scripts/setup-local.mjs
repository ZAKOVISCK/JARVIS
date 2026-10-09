import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../',import.meta.url));
function node(script,args=[]){
  const result=spawnSync(process.execPath,[fileURLToPath(new URL(script,import.meta.url)),...args],{cwd:root,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
}
node('./prepare-demo-data.mjs');
node('./prepare-ocr-assets.mjs');
// Explicitly local; this command cannot target a remote database.
node('../node_modules/wrangler/bin/wrangler.js',['d1','migrations','apply','DB','--local','--config','wrangler.local.jsonc','--persist-to','.wrangler/state']);
console.log('Ambiente local pronto. Use pnpm dev e a entrada local documentada no README.');
