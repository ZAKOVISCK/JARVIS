import type {VehicleData} from './fleet.ts';
type Pending={controller:AbortController;promise:Promise<VehicleData>;users:number};

/** Shared per-device reads; abandoning one panel never aborts another reader. */
export class VehicleResource{
 private cache=new Map<string,VehicleData>();
 private pending=new Map<string,Pending>();
 private fetcher:typeof fetch;
 private capacity:number;
 constructor(fetcher:typeof fetch=fetch,capacity=20){if(!Number.isInteger(capacity)||capacity<1)throw new TypeError('Capacidade de cache inválida.');this.fetcher=fetcher;this.capacity=capacity}
 invalidate(code:string){this.cache.delete(code)}
 acquire(code:string){
  if(!/^\d{1,3}$/.test(code)||Number(code)<1||Number(code)>559)throw new Error('Prefixo fora da frota operacional.');
  code=String(Number(code));
  const cached=this.cache.get(code);
  if(cached){this.cache.delete(code);this.cache.set(code,cached);return {promise:Promise.resolve(cached),release:()=>{}}}
  let request=this.pending.get(code);
  if(!request){
   const controller=new AbortController();
   const entry:Pending={controller,users:0,promise:Promise.resolve(null as unknown as VehicleData)};
   entry.promise=this.fetcher(`/data/${encodeURIComponent(code)}.json`,{signal:controller.signal}).then(async response=>{
    if(!response.ok)throw new Error('Histórico do veículo indisponível. Tente novamente.');
    const data=await response.json() as VehicleData;
    if(!data||String(data.code)!==code||!Array.isArray(data.parts)||!Array.isArray(data.services))throw new Error('A fonte não corresponde ao veículo selecionado.');
    if(controller.signal.aborted)throw new DOMException('Leitura cancelada','AbortError');
    this.cache.set(code,data);while(this.cache.size>this.capacity)this.cache.delete(this.cache.keys().next().value!);
    return data;
   }).finally(()=>{if(this.pending.get(code)===entry)this.pending.delete(code)});
   request=entry;this.pending.set(code,entry);
  }
  request.users++;const active=request;let released=false;
  return {promise:active.promise,release:()=>{if(released)return;released=true;active.users--;if(active.users===0&&this.pending.get(code)===active){this.pending.delete(code);active.controller.abort()}}};
 }
}
