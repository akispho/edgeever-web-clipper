import { EdgeEverClient, Memo, Notebook, EditSession } from './edgeever-client';
import type { Template } from '../types/types';
import { imageReferences, rewriteImages, downloadImage, inlineReferences } from './page-images';
export interface ClipInput {content:string;noteName:string;notebookId:string;path:string;behavior:Template['behavior'];sourceUrl:string;now?:Date}
export interface SaveResult {memoId:string;images:number;totalImages:number;warning?:string}
const behaviors=['create','append-specific','prepend-specific','append-daily','prepend-daily','overwrite'];
export function validateClip(input:ClipInput):void {
 if(!input || typeof input.content!=='string' || !input.content.trim() || input.content.length>10*1024*1024 || typeof input.noteName!=='string' || typeof input.notebookId!=='string' || typeof input.path!=='string' || !behaviors.includes(input.behavior)) throw new Error('无效的剪藏内容或保存设置。');
 const url=new URL(input.sourceUrl); if(!['http:','https:'].includes(url.protocol)) throw new Error('不支持的剪藏来源地址。');
}
export function notebookLabel(notebooks:Notebook[],id:string):string {
 const names:string[]=[]; const seen=new Set<string>(); let current=notebooks.find(n=>n.id===id);
 while(current && !seen.has(current.id)) {seen.add(current.id);names.unshift(current.name);current=notebooks.find(n=>n.id===current!.parentId);}
 return names.join(' / ');
}
export async function resolveNotebook(client:EdgeEverClient, notebookId:string, path:string):Promise<string> {
 const notebooks=await client.notebooks();
 if(!notebookId || !notebooks.some(n=>n.id===notebookId)) throw new Error('笔记本未选择或已失效，请在设置中重新连接并选择。');
 let parent=notebookId;
 const parts=path.split('/').filter(Boolean);
 if(parts.some(p=>p==='.' || p==='..' || p.length>80)) throw new Error('无效的笔记本路径。');
 for(const name of parts) {
  const matches=notebooks.filter(n=>n.parentId===parent && n.name===name);
  if(matches.length>1) throw new Error('路径对应多个同名笔记本，请选择唯一目标。');
  const notebook=matches[0] || await client.createNotebook(name,parent); parent=notebook.id;
  if(!matches.length) notebooks.push(notebook);
 }
 return parent;
}
async function findTarget(client:EdgeEverClient,notebookId:string,title:string):Promise<string|undefined> {
 let cursor:string|null=null; const seen=new Set<string>(); const matches=new Set<string>();
 do {
  const params=new URLSearchParams({notebookId,limit:'200'}); if(cursor) params.set('cursor',cursor);
  const result=await client.request<{memos:Array<{id:string;title:string;notebookId:string}>;nextCursor:string|null}>(`/api/v1/memos?${params}`);
  if(!Array.isArray(result.memos)) throw new Error('EdgeEver 笔记列表无效。');
  for(const memo of result.memos) if(memo.notebookId===notebookId && memo.title===title) matches.add(memo.id);
  if(matches.size>1) throw new Error('存在多个同名笔记 / multiple matching notes，请先指定唯一目标。');
  cursor=result.nextCursor || null; if(cursor && seen.has(cursor)) throw new Error('EdgeEver 分页游标重复，已停止保存。'); if(cursor) seen.add(cursor);
 } while(cursor);
 return matches.values().next().value;
}
function sessionMatches(session:EditSession,memo:Memo):boolean {return session.baseRevision===memo.revision && session.baseContentHash===memo.contentHash;}
function hasStructuredContent(value:unknown):boolean {
 if(typeof value==='string') return !!value.trim();
 if(Array.isArray(value)) return value.some(hasStructuredContent);
 if(!value || typeof value!=='object') return false;
 const node=value as {type?:string;text?:string;content?:unknown};
 if(node.text?.trim()) return true;
 if(node.type && !['doc','paragraph','text'].includes(node.type)) return true;
 if(!node.type && Object.keys(node).length) return true;
 return hasStructuredContent(node.content);
}
export async function saveClip(client:EdgeEverClient,input:ClipInput):Promise<SaveResult> {
 validateClip(input);
 const now=input.now || new Date();
 const daily=input.behavior.endsWith('-daily');
 const title=daily ? `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}` : input.noteName.trim();
 if(!title || title.length>160) throw new Error('笔记标题不能为空或超过 160 个字符。');
 const notebookId=await resolveNotebook(client,input.notebookId,input.path);
 const target=input.behavior==='create' ? undefined : await findTarget(client,notebookId,title);
 let memo:Memo;
 let captured=input.content;
 let compose=(content:string)=>content;
 if(target) {
  const current=await client.memo(target); const session=await client.editSession(target);
  if(current.notebookId!==notebookId || current.title!==title || !sessionMatches(session,current)) throw new Error('目标笔记已移动或修改，请重新剪藏。');
  if(input.behavior!=='overwrite') {
   if(!current.contentMarkdown.trim() && hasStructuredContent(current.contentJson)) throw new Error('目标是仅含富文本的笔记，请先在 EdgeEver 中转换为 Markdown 后再追加；未修改原文。');
   captured=inlineReferences(input.content);
   compose=input.behavior.startsWith('append') ? content=>`${current.contentMarkdown}\n\n${content}` : content=>`${content}\n\n${current.contentMarkdown}`;
  }
  memo=await client.save(target,session,compose(captured),input.behavior==='overwrite');
 } else { memo=await client.create({notebookId,title,contentMarkdown:input.content,tags:['web-clip']}); }
 const result:SaveResult={memoId:memo.id,images:0,totalImages:0};
 // Only images referenced by this capture are downloaded, even when appending to an existing note.
 const urls=[...new Set(imageReferences(captured,input.sourceUrl).map(r=>r.url))].filter(url=>!url.startsWith(`${client.baseUrl}/api/v1/resources/`));
 result.totalImages=urls.length;
 if(!urls.length) return result;
 const uploaded=new Map<string,string>(); let remaining=60*1024*1024;
 const deadline=Date.now()+45000;
 for(const [index,url] of urls.slice(0,30).entries()) {
  if(Date.now()>=deadline || remaining<=0) break;
  try {
   const signal=AbortSignal.timeout(Math.max(1,Math.min(15000,deadline-Date.now())));
   const blob=await downloadImage(url,signal,Math.min(20*1024*1024,remaining)); remaining-=blob.size;
   const ext=blob.type.split('/')[1]?.replace('svg+xml','svg').replace('jpeg','jpg') || 'img';
   uploaded.set(url,await client.upload(memo.id,blob,`clip-${index+1}.${ext}`,signal));
  } catch { /* Keep the remote URL and report partial success. */ }
 }
 if(uploaded.size) {
  try {
   const session=await client.editSession(memo.id);
   if(!sessionMatches(session,memo)) throw new Error('concurrent edit');
   await client.save(memo.id,session,compose(rewriteImages(captured,uploaded,input.sourceUrl))); result.images=uploaded.size;
  } catch { result.warning='正文已保存，但笔记已变化或附件链接更新失败；原图片地址已保留，请打开 EdgeEver 检查。'; }
 }
 if(result.images<result.totalImages && !result.warning) result.warning=`正文已保存；图片 ${result.images}/${result.totalImages} 已存入附件库，其余保留原地址。`;
 return result;
}
