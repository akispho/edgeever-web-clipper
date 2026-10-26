import { fromMarkdown } from 'mdast-util-from-markdown';

interface ImageRef { href:string; url:string; start:number; end:number; label:string; title?:string|null }
export function imageReferences(markdown: string, baseUrl: string): ImageRef[] {
 const root=fromMarkdown(markdown);
 const definitions=new Map<string, {url:string;title?:string|null}>();
 function definitionsIn(node:any) { if(node.type==='definition' && !definitions.has(node.identifier)) definitions.set(node.identifier,node); for(const child of node.children||[]) definitionsIn(child); }
 definitionsIn(root);
 const refs:ImageRef[]=[];
 function visit(node:any) {
  if(node.type==='image' || node.type==='imageReference') {
   const target=node.type==='image' ? node : definitions.get(node.identifier);
   if(target?.url && node.position) {
    try {
     const url=new URL(target.url,baseUrl);
     if(['http:','https:'].includes(url.protocol) && !url.username && !url.password) refs.push({href:target.url,url:url.href,start:node.position.start.offset,end:node.position.end.offset,label:node.alt||'',title:target.title});
    } catch { /* Unsupported image URLs retain their source spelling. */ }
   }
  }
  for(const child of node.children||[]) visit(child);
 }
 visit(root); return refs;
}
export function rewriteImages(markdown:string, uploaded:Map<string,string>, baseUrl:string):string {
 for(const ref of imageReferences(markdown,baseUrl).reverse()) {
  const url=uploaded.get(ref.url); if(!url) continue;
  const alt=ref.label.replace(/\\/g,'\\\\').replace(/\[/g,'\\[').replace(/\]/g,'\\]');
  const title=ref.title ? ` "${ref.title.replace(/\\/g,'\\\\').replace(/"/g,'\\"')}"` : '';
  markdown=markdown.slice(0,ref.start)+`![${alt}](${url}${title})`+markdown.slice(ref.end);
 }
 return markdown;
}

const MAX_IMAGE_BYTES=20*1024*1024;
export async function downloadImage(url:string, signal:AbortSignal, maxBytes=MAX_IMAGE_BYTES):Promise<Blob> {
 const response=await fetch(url,{credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal});
 if(!response.ok || !response.body || Number(response.headers.get('content-length'))>maxBytes) throw new Error('Image unavailable or too large.');
 const type=response.headers.get('content-type')?.split(';')[0] || '';
 if(!/^image\/(png|jpe?g|gif|webp|avif|bmp|svg\+xml|x-icon)$/i.test(type)) throw new Error('Unsupported image type.');
 const reader=response.body.getReader(); const chunks:ArrayBuffer[]=[]; let size=0;
 try {
  while(true) {
   const {done,value}=await reader.read(); if(done) break;
   size+=value.byteLength; if(size>maxBytes) throw new Error('Image too large.');
   chunks.push(value.slice().buffer);
  }
 } finally { await reader.cancel().catch(()=>{}); }
 return new Blob(chunks,{type});
}

/** Make one captured document self-contained before merging its reference namespace. */
export function inlineReferences(markdown:string):string {
 const root=fromMarkdown(markdown);const definitions=new Map<string,any>();
 function collect(node:any) {if(node.type==='definition' && !definitions.has(node.identifier)) definitions.set(node.identifier,node);for(const child of node.children||[]) collect(child);}
 collect(root);
 function render(node:any):string {
  const start=node.position?.start.offset ?? 0;const end=node.position?.end.offset ?? markdown.length;
  if(node.type==='definition') return '';
  if(node.type==='linkReference' || node.type==='imageReference') {
   const definition=definitions.get(node.identifier);
   if(definition) {
    const label=node.type==='imageReference' ? (node.alt||'').replace(/\\/g,'\\\\').replace(/[\[\]]/g,'\\$&') : (node.children||[]).map(render).join('');
    const url=definition.url.replace(/\\/g,'%5C').replace(/</g,'%3C').replace(/>/g,'%3E');
    const title=definition.title ? ` "${definition.title.replace(/\\/g,'\\\\').replace(/"/g,'\\"')}"` : '';
    return `${node.type==='imageReference'?'!':''}[${label}](<${url}>${title})`;
   }
  }
  let raw=markdown.slice(start,end);
  for(const child of [...(node.children||[])].reverse()) {
   const a=child.position?.start.offset,b=child.position?.end.offset;
   if(a!==undefined && b!==undefined) raw=raw.slice(0,a-start)+render(child)+raw.slice(b-start);
  }
  return raw;
 }
 return render(root);
}
