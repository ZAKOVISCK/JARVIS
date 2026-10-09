import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
if (!files.length) throw new Error('A auditoria precisa de um índice Git com os arquivos preparados.');
const prohibited = /^(?:public\/data\/|private-data\/|backups\/|reports\/|docs\/(?:baseline|reviews|design-review)\/)|(?:^|\/)\.env(?:\.|$)|\.(?:xlsx?|xlsm|csv|tsv|sqlite3?|db|tar\.gz|zip)$/i;
const failures=files.filter(name=>prohibited.test(name));
const hosting=JSON.parse(readFileSync('.openai/hosting.json','utf8'));
if (hosting.project_id) failures.push('.openai/hosting.json: identidade de hospedagem real');
const secretPatterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bgh[pousr]_[A-Za-z0-9]{30,}\b/,/\bgithub_pat_[A-Za-z0-9_]{30,}\b/,/\bsk-(?:proj-)?[A-Za-z0-9_-]{35,}\b/];
for(const name of files){
  if(!/\.(?:[cm]?[jt]sx?|json|jsonc|md|yaml|yml|toml|sh|py|txt)$/.test(name))continue;
  if(secretPatterns.some(pattern=>pattern.test(readFileSync(name,'utf8'))))failures.push(name+': possível segredo');
}
if(failures.length){console.error('Publicação bloqueada. Revise os arquivos:');console.error(failures.join('\n'));process.exit(1)}
console.log(`Auditoria pública aprovada: ${files.length} arquivos; dados, planilhas, relatórios privados e identidade de produção ausentes do índice.`);
