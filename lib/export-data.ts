/** Quote all fields and neutralize spreadsheet formulas, including hidden prefixes. */
export function csvCell(value:unknown){
 const text=String(value??'');
 const formula=typeof value==='string'&&/^[\s\u0000-\u001f\u007f-\u009f\ufeff]*[=+@-]/u.test(text);
 return '"'+(formula?"'":'')+text.replaceAll('"','""')+'"';
}
export function csvDocument(rows:unknown[][]){return '\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n')}

/** Attach the download link for Safari and release its URL after navigation starts. */
export function downloadData(content:string|BlobPart[],filename:string,type:string){
 const url=URL.createObjectURL(new Blob(typeof content==='string'?[content]:content,{type})),link=document.createElement('a');
 link.href=url;link.download=filename;link.style.display='none';document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
