import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';

// Execute the real component with deterministic hooks and browser adapters.
// No server, production data, microphone, or additional test dependency is used.
const require=createRequire(import.meta.url);
const source=fs.readFileSync(new URL('../components/cognitive/command-bar.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
function commandHarness(window={},options={}){
 const slots=[],pending=[];let cursor=0;
 const hooks={
  useMemo(callback){return callback()},
  useId(){return 'command-review-id'},
  useState(initial){const index=cursor++;if(!slots[index])slots[index]={state:initial};return [slots[index].state,value=>{slots[index].state=typeof value==='function'?value(slots[index].state):value}]},
  useRef(initial){const index=cursor++;if(!slots[index])slots[index]={current:initial};return slots[index]},
  useEffect(effect,deps){const index=cursor++,previous=slots[index];if(!previous||!deps||deps.some((dep,i)=>dep!==previous.deps[i]))pending.push(()=>{previous?.cleanup?.();slots[index]={deps,cleanup:effect()}})},
 };
 const exports={};
 vm.runInNewContext(options.compiled||compiled,{exports,window,...options.globals,require(name){if(name==='react')return hooks;if(name==='lucide-react'||name.startsWith('@/components/'))return {};if(name.startsWith('@/lib/'))return require('../lib/'+name.slice('@/lib/'.length)+'.ts');return require(name)}});
 return {render(props){cursor=0;const tree=exports[options.component||'CommandBar']({onSubmit(){},catalog:null,...props});pending.splice(0).forEach(effect=>effect());return tree},unmount(){slots.forEach(slot=>slot?.cleanup?.())}};
}
function nodes(tree,predicate){const result=[];function visit(node){if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(visit);return}if(predicate(node))result.push(node);visit(node.props?.children)}visit(tree);return result}
const byLabel=(tree,label)=>nodes(tree,node=>node.props?.['aria-label']===label)[0];
const byText=(tree,text)=>nodes(tree,node=>node.type==='button'&&node.props.children===text)[0];

test('bloquear uma consulta desabilita voz, imagem, código e seleção do veículo',()=>{
 const harness=commandHarness(),tree=harness.render({disabled:true,onSelectVehicle(){}});
 for(const label of ['Falar uma consulta','Ler imagem da peça ou do código','Código da peça','Selecionar veículo','Enviar comando'])assert.equal(byLabel(tree,label).props.disabled,true,label);
 assert.equal(nodes(tree,node=>node.type==='input'&&node.props.type==='file')[0].props.disabled,true);
 assert.equal(byText(tree,'Selecionar imagem').props.disabled,true);
 assert.equal(nodes(tree,node=>node.type==='textarea')[0].props.disabled,true);
 harness.unmount();
});

test('texto identificado antes da consulta não altera o comando enquanto bloqueado',()=>{
 const harness=commandHarness();let tree=harness.render();
 nodes(tree,node=>node.type==='textarea')[0].props.onChange({target:{value:'Bico Injetor'}});
 tree=harness.render({disabled:true});
 const apply=byText(tree,'Usar texto e revisar');assert.equal(apply.props.disabled,true);
 apply.props.onClick(); // Guard remains effective for a stale programmatic event.
 tree=harness.render({disabled:true});
 assert.equal(nodes(tree,node=>node.type==='input'&&!node.props.type)[0].props.value,'');
 tree=harness.render({disabled:false});
 byText(tree,'Usar texto e revisar').props.onClick();
 tree=harness.render({disabled:false});
 assert.equal(nodes(tree,node=>node.type==='input'&&!node.props.type)[0].props.value,'Bico Injetor');
 harness.unmount();
});

test('consulta aborta voz em andamento e ignora resultado tardio',()=>{
 const sessions=[];let aborted=0;
 class SpeechRecognition{constructor(){sessions.push(this)}start(){}stop(){}abort(){aborted++;this.onend?.()}}
 const harness=commandHarness({SpeechRecognition});let tree=harness.render();
 byLabel(tree,'Falar uma consulta').props.onClick();
 tree=harness.render();assert.equal(byLabel(tree,'Parar reconhecimento de voz').props['aria-pressed'],true);
 harness.render({disabled:true});assert.equal(aborted,1);assert.equal(sessions[0].onresult,null);
 tree=harness.render({disabled:false});assert.equal(byLabel(tree,'Falar uma consulta').props['aria-pressed'],false);
 assert.equal(nodes(tree,node=>node.type==='input'&&!node.props.type)[0].props.value,'');
 harness.unmount();
});

test('desmontar a barra libera a sessão de voz e remove callbacks',()=>{
 const sessions=[];let aborted=0;
 class SpeechRecognition{constructor(){sessions.push(this)}start(){}stop(){}abort(){aborted++}}
 const harness=commandHarness({SpeechRecognition});
 byLabel(harness.render(),'Falar uma consulta').props.onClick();
 harness.unmount();assert.equal(aborted,1);assert.equal(sessions[0].onresult,null);assert.equal(sessions[0].onend,null);assert.equal(sessions[0].onerror,null);
});

function researchHarness(fetch){
 let tool;
 const research=fs.readFileSync(new URL('../components/jarvis/research.tsx',import.meta.url),'utf8');
 const harness=commandHarness({}, {component:'SearchWorkspace',compiled:ts.transpileModule(research,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,globals:{crypto:globalThis.crypto,AbortController,fetch,document:{modelContext:{registerTool(value){tool=value}}}}});
 const props={summary:{fleet:[],datasetMode:'synthetic'},catalog:null,onHistory(){},onMaintenance(){},visible:true};
 return {render(){return harness.render(props)},tool:()=>tool,unmount:()=>harness.unmount()};
}
const testSnapshot={id:'TEST-UI-QUERY',queriedAt:'2026-10-01T12:00:00Z',prefix:'55154',resolvedPart:'Filtro',validated:false,status:'not_found',warnings:[],checks:[],evidence:[],evidenceCount:0,sourceMode:'sheets'};

test('ferramenta assistida registra os critérios efetivamente enviados sem falso aviso',async()=>{
 let request;const harness=researchHarness(async(url,init)=>{request=JSON.parse(init.body);return {ok:true,json:async()=>({saved:true,records:[testSnapshot]})}});
 harness.render();const query='Última saída de filtro do prefixo 55154';
 await harness.tool().execute({query});
 let tree=harness.render();assert.equal(request.items[0].query,query);
 assert.equal(nodes(tree,node=>node.props?.className==='criteria-changed').length,0);
 const input=nodes(tree,node=>node.props?.id==='investigation-question')[0];
 assert.equal(input.props.value,query);input.props.onChange({target:{value:'Última saída de bico do prefixo 55154'}});
 tree=harness.render();assert.equal(nodes(tree,node=>node.props?.className==='criteria-changed').length,1);
 harness.unmount();
});

test('segunda chamada assistida não muda critérios nem duplica a consulta em andamento',async()=>{
 let finish;const pending=new Promise(resolve=>finish=resolve);let calls=0;
 const harness=researchHarness(async()=>{calls++;await pending;return {ok:true,json:async()=>({saved:true,records:[testSnapshot]})}});
 harness.render();const query='Filtro do prefixo 55154';
 const first=harness.tool().execute({query});
 await assert.rejects(harness.tool().execute({query:'Bico do prefixo 55125'}),/consulta em andamento/);
 finish();await first;const tree=harness.render();
 assert.equal(calls,1);assert.equal(nodes(tree,node=>node.props?.id==='investigation-question')[0].props.value,query);
 assert.equal(nodes(tree,node=>node.props?.className==='criteria-changed').length,0);
 harness.unmount();
});
