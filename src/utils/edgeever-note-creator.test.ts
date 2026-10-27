import { afterEach, describe, expect, it, vi } from 'vitest';
import { EdgeEverClient } from './edgeever-client';
import { saveClip, resolveNotebook, parseClipTags } from './edgeever-note-creator';
import { imageReferences, rewriteImages } from './page-images';
const settings = {instanceUrl:'https://notes.test',token:'secret'};
let writes: Array<{path:string;body:any}>;
let memos: any[];
let revision = 1;
function server() {
 writes=[]; memos=[]; revision=1;
 vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
  const path = url.replace('https://notes.test','');
  const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
  if (init.method === 'POST') writes.push({path,body});
  if (path === '/api/v1/notebooks') return Response.json({notebooks:[{id:'nb',name:'Inbox',parentId:null}]});
  if (path.startsWith('/api/v1/memos?')) return Response.json({memos,nextCursor:null});
  if (path === '/api/v1/memos') return Response.json({memo:{id:'m',revision:1,contentHash:'a'.repeat(64),...body}});
  if (path === '/api/v1/memos/m') return Response.json({memo:{id:'m',notebookId:'nb',title:'Title',revision,contentHash:'a'.repeat(64),contentMarkdown:'old'}});
  if (path.endsWith('/edit-sessions')) return Response.json({editSession:{id:'session',baseRevision:revision,baseContentHash:'a'.repeat(64)}});
  if (path.endsWith('/save')) return Response.json({memo:{id:'m',revision:2,contentHash:'b'.repeat(64),...body}});
  throw new Error('Unexpected request '+path);
 });
}
afterEach(() => vi.unstubAllGlobals());
describe('EdgeEver saving', () => {
 it('uses the edited tags and selected notebook without creating a child', async () => {
  server();
  await saveClip(new EdgeEverClient(settings),{content:'body',noteName:'Title',notebookId:'nb',path:'',tags:['clippings','travel'],behavior:'create',sourceUrl:'https://example.org'});
  expect(writes).toHaveLength(1);
  expect(writes[0].body).toMatchObject({notebookId:'nb',tags:['clippings','travel']});
 });
 it('does not inject tags when the user leaves them empty', async () => {
  server();
  await saveClip(new EdgeEverClient(settings),{content:'body',noteName:'Title',notebookId:'nb',path:'',tags:[],behavior:'create',sourceUrl:'https://example.org'});
  expect(writes[0].body.tags).toEqual([]);
 });
 it('parses comma-separated and JSON tag lists without duplicates', () => {
  expect(parseClipTags(' #clippings, travel, clippings, ,中文 ')).toEqual(['clippings','travel','中文']);
  expect(parseClipTags('["clippings", "travel", "clippings"]')).toEqual(['clippings','travel']);
  expect(parseClipTags('')).toEqual([]);
  expect(()=>parseClipTags('["valid",1]')).toThrow();
 });
 it.each(['append-specific','prepend-specific','overwrite'])('updates tags safely for %s', async behavior => {
  server(); memos=[{id:'m',title:'Title',notebookId:'nb'}]; const original=fetch;
  vi.stubGlobal('fetch', async (url:string,init:RequestInit={}) => {
   const response=await original(url,init);
   if(url==='https://notes.test/api/v1/memos/m') {const data=await response.json();data.memo.tags=['existing'];return Response.json(data);}
   return response;
  });
  await saveClip(new EdgeEverClient(settings),{content:'new',noteName:'Title',notebookId:'nb',path:'',tags:['clippings'],behavior:behavior as any,sourceUrl:'https://example.org'});
  expect(writes.find(w=>w.path.endsWith('/save'))?.body.tags).toEqual(behavior==='overwrite' ? ['clippings'] : ['existing','clippings']);
 });
 it('creates a child only for an explicitly supplied name', async () => {
  server(); const original=fetch;
  vi.stubGlobal('fetch',async (url:string,init:RequestInit={}) => {
   if(url==='https://notes.test/api/v1/notebooks' && init.method==='POST') {
    const body=JSON.parse(init.body as string);writes.push({path:'/api/v1/notebooks',body});
    return Response.json({notebook:{id:'child',...body}});
   }
   return original(url,init);
  });
  await saveClip(new EdgeEverClient(settings),{content:'body',noteName:'Title',notebookId:'nb',path:'Travel',tags:[],behavior:'create',sourceUrl:'https://example.org'});
  expect(writes[0]).toEqual({path:'/api/v1/notebooks',body:{name:'Travel',parentId:'nb'}});
  expect(writes[1].body.notebookId).toBe('child');
 });
 it('creates an editable memo with the unmodified rendered Markdown', async () => {
  server(); const result = await saveClip(new EdgeEverClient(settings),{content:'---\nsource: example\n---\n# Body',noteName:'Title',notebookId:'nb',path:'',behavior:'create',sourceUrl:'https://example.org'});
  expect(writes[0].body).toMatchObject({notebookId:'nb',title:'Title',contentMarkdown:'---\nsource: example\n---\n# Body'});
  expect(result.memoId).toBe('m');
 });
 it.each([['append-specific','old\n\nnew'],['prepend-specific','new\n\nold'],['overwrite','new']])('maps %s to a versioned update', async (behavior,content) => {
  server(); memos=[{id:'m',title:'Title',notebookId:'nb'}];
  await saveClip(new EdgeEverClient(settings),{content:'new',noteName:'Title',notebookId:'nb',path:'',behavior:behavior as any,sourceUrl:'https://example.org'});
  expect(writes.find(w=>w.path.endsWith('/save'))?.body).toMatchObject({contentMarkdown:content,editSessionId:'session',expectedRevision:1,expectedContentHash:'a'.repeat(64)});
  if(behavior==='overwrite') expect(writes.find(w=>w.path.endsWith('/save'))?.body.allowDestructiveOverwrite).toBe(true);
 });
 it.each(['append-daily','prepend-daily'])('uses local calendar date for %s', async behavior => {
  server(); await saveClip(new EdgeEverClient(settings),{content:'new',noteName:'ignored',notebookId:'nb',path:'',behavior:behavior as any,sourceUrl:'https://example.org',now:new Date(2026,9,26,23,30)});
  expect(writes[0].body.title).toBe('2026-10-26');
 });
 it('rejects duplicate titles and stale notebook IDs before writing', async () => {
  server(); memos=[{id:'m',title:'Title',notebookId:'nb'},{id:'m2',title:'Title',notebookId:'nb'}];
  await expect(saveClip(new EdgeEverClient(settings),{content:'new',noteName:'Title',notebookId:'nb',path:'',behavior:'overwrite',sourceUrl:'https://example.org'})).rejects.toThrow(/multiple|多个/i);
  await expect(resolveNotebook(new EdgeEverClient(settings),'missing','')).rejects.toThrow(); expect(writes).toEqual([]);
 });
 it('never masks an update conflict as a successful save', async () => {
  server(); memos=[{id:'m',title:'Title',notebookId:'nb'}]; const original=fetch;
  vi.stubGlobal('fetch',async (url:string,init:RequestInit)=> url.endsWith('/save') ? Response.json({}, {status:409}) : original(url,init));
  await expect(saveClip(new EdgeEverClient(settings),{content:'new',noteName:'Title',notebookId:'nb',path:'',behavior:'overwrite',sourceUrl:'https://example.org'})).rejects.toThrow(/409/);
 });
});
describe('page images',()=>{
 it('parses nested URLs and references without changing code examples',()=>{
  const markdown='![x](https://img.test/a(b).png)\n![ref][photo]\n\n[photo]: https://img.test/ref.png\n\n```md\n![x](https://img.test/a(b).png)\n```';
  const refs=imageReferences(markdown,'https://example.org'); expect(refs).toHaveLength(2);
  const result=rewriteImages(markdown,new Map([['https://img.test/a(b).png','https://notes.test/api/v1/resources/a/blob'],['https://img.test/ref.png','https://notes.test/api/v1/resources/b/blob']]),'https://example.org');
  expect(result).toContain('![ref](https://notes.test/api/v1/resources/b/blob)'); expect(result).toContain('```md\n![x](https://img.test/a(b).png)');
 });
});

describe('attachment copy outcomes',()=>{
 it('uploads readable images without an API token and preserves failed sources',async()=>{
  server(); const original=fetch; const imageRequests:RequestInit[]=[];
  vi.stubGlobal('fetch',async(url:string,init:RequestInit={})=>{
   if(url.startsWith('https://images.test/')) { imageRequests.push(init); return url.endsWith('ok.png') ? new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/png'}}) : new Response('',{status:403}); }
   if(url.endsWith('/resources')) return Response.json({resource:{id:'image-1'}});
   return original(url,init);
  });
  const result=await saveClip(new EdgeEverClient(settings),{content:'![ok](https://images.test/ok.png)\n![bad](https://images.test/bad.png)',noteName:'Title',notebookId:'nb',path:'',behavior:'create',sourceUrl:'https://example.org'});
  expect(result).toMatchObject({images:1,totalImages:2}); expect(result.warning).toContain('1/2');
  const final=writes.find(w=>w.path.endsWith('/save'))!.body.contentMarkdown;
  expect(final).toContain('https://notes.test/api/v1/resources/image-1/blob'); expect(final).toContain('https://images.test/bad.png');
  for(const init of imageRequests) { expect(new Headers(init.headers).has('Authorization')).toBe(false);expect(init.credentials).toBe('omit'); }
 });
 it('preserves a concurrent edit during image transfer',async()=>{
  server(); const original=fetch;
  vi.stubGlobal('fetch',async(url:string,init:RequestInit={})=>{
   if(url==='https://images.test/ok.png') return new Response(new Uint8Array([1]),{headers:{'content-type':'image/png'}});
   if(url.endsWith('/resources')) {revision=3;return Response.json({resource:{id:'image-1'}});}
   return original(url,init);
  });
  const result=await saveClip(new EdgeEverClient(settings),{content:'![ok](https://images.test/ok.png)',noteName:'Title',notebookId:'nb',path:'',behavior:'create',sourceUrl:'https://example.org'});
  expect(result.images).toBe(0);expect(result.warning).toBeTruthy();expect(writes.filter(w=>w.path.endsWith('/save'))).toHaveLength(0);
 });
 it('rejects path traversal before creating child notebooks',async()=>{
  server();await expect(resolveNotebook(new EdgeEverClient(settings),'nb','missing/../x')).rejects.toThrow(); expect(writes).toHaveLength(0);
 });
 it('follows pagination to detect an ambiguous target before updating',async()=>{
  server();const original=fetch;
  vi.stubGlobal('fetch',async(url:string,init:RequestInit={})=>url.includes('/memos?') ? Response.json({memos:[{id:url.includes('cursor=next')?'m2':'m',title:'Title',notebookId:'nb'}],nextCursor:url.includes('cursor=next')?null:'next'}) : original(url,init));
  await expect(saveClip(new EdgeEverClient(settings),{content:'new',noteName:'Title',notebookId:'nb',path:'',behavior:'overwrite',sourceUrl:'https://example.org'})).rejects.toThrow(/multiple/);expect(writes).toHaveLength(0);
 });
});

describe('review regression: structured and reference content',()=>{
 it.each(['append-specific','prepend-specific'])('refuses %s on a rich-text-only body without losing existing content',async behavior=>{
  server();memos=[{id:'m',title:'Title',notebookId:'nb'}];const original=fetch;
  vi.stubGlobal('fetch',async(url:string,init:RequestInit={})=>url==='https://notes.test/api/v1/memos/m' ? Response.json({memo:{id:'m',notebookId:'nb',title:'Title',revision:1,contentHash:'a'.repeat(64),contentMarkdown:'',contentJson:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'keep my rich text'}]}]}}}) : original(url,init));
  await expect(saveClip(new EdgeEverClient(settings),{content:'new',noteName:'Title',notebookId:'nb',path:'',behavior:behavior as any,sourceUrl:'https://example.org'})).rejects.toThrow(/富文本|rich/i);
  expect(writes.filter(w=>w.path.endsWith('/save'))).toHaveLength(0);
 });
 it.each(['append-specific','prepend-specific'])('isolates captured reference definitions when using %s',async behavior=>{
  server();memos=[{id:'m',title:'Title',notebookId:'nb'}];const original=fetch;
  const existing='![old][photo]\n\n[photo]: https://images.test/old.png';
  vi.stubGlobal('fetch',async(url:string,init:RequestInit={})=>{
   if(url==='https://notes.test/api/v1/memos/m') return Response.json({memo:{id:'m',notebookId:'nb',title:'Title',revision:1,contentHash:'a'.repeat(64),contentMarkdown:existing}});
   if(url==='https://images.test/new.png') return new Response(new Uint8Array([1]),{headers:{'content-type':'image/png'}});
   if(url.endsWith('/resources')) return Response.json({resource:{id:'new-image'}});
   if(url.endsWith('/edit-sessions') && writes.some(w=>w.path.endsWith('/save'))) return Response.json({editSession:{id:'session2',baseRevision:2,baseContentHash:'b'.repeat(64)}});
   return original(url,init);
  });
  const result=await saveClip(new EdgeEverClient(settings),{content:'![new][photo]\n\n[photo]: https://images.test/new.png',noteName:'Title',notebookId:'nb',path:'',behavior:behavior as any,sourceUrl:'https://example.org'});
  expect(result.images).toBe(1);
  const final=writes.filter(w=>w.path.endsWith('/save')).slice(-1)[0]!.body.contentMarkdown;
  expect(imageReferences(final,'https://example.org').map(ref=>ref.url).sort()).toEqual(['https://images.test/old.png','https://notes.test/api/v1/resources/new-image/blob'].sort());
 });
});
