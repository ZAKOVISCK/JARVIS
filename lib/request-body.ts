export class BodyLimitError extends Error {}
export async function readLimitedText(request:Request,limit:number){if(!request.body)return '';const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new BodyLimitError('Solicitação acima do limite.')}chunks.push(value)}}finally{reader.releaseLock()}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}

/** Validate client data before a route consults or mutates its database. */
export async function readLimitedJsonObject(request:Request,limit:number):Promise<Record<string,unknown>>{
 let text:string;
 try{text=await readLimitedText(request,limit)}catch(error){
  if(error instanceof TypeError)throw new SyntaxError('O corpo da solicitação deve usar UTF-8 válido.');
  throw error;
 }
 const value:unknown=JSON.parse(text);
 if(!value||typeof value!=='object'||Array.isArray(value))throw new SyntaxError('Informe um objeto JSON válido.');
 return value as Record<string,unknown>;
}
