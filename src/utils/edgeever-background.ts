import browser from './browser-polyfill';
import { EdgeEverClient, normalizeInstanceUrl } from './edgeever-client';
import { connectionStore } from './edgeever-connection';
import { saveClip, validateClip } from './edgeever-note-creator';

export function trustedDestinationPage(url:string|undefined,base:string):boolean {
 return !!url && ['popup.html','side-panel.html','settings.html'].some(page=>url.split('?')[0]===base+page);
}
let saving=false;
export function registerEdgeEverDestination():void {
 browser.runtime.onMessage.addListener((request:any,sender:any,sendResponse:(value:any)=>void):true|undefined=>{
  if(!request || !['edgeever-connection','edgeever-configure','edgeever-save'].includes(request.action)) return;
  if(!trustedDestinationPage(sender.url,browser.runtime.getURL(''))) {sendResponse({ok:false,error:'EdgeEver destination is restricted to extension pages.'});return true;}
  (async()=>{
   const saved=await connectionStore();
   if(request.action==='edgeever-connection') return {instanceUrl:saved?.instanceUrl||'',notebookId:saved?.notebookId||'',notebooks:saved?.notebooks||[],hasToken:!!saved?.token};
   if(request.action==='edgeever-configure') {
    if(typeof request.instanceUrl!=='string' || typeof request.token!=='string' || typeof request.notebookId!=='string') throw new Error('无效的连接设置。');
    const instanceUrl=normalizeInstanceUrl(request.instanceUrl);
    const token=request.token.trim() || (saved?.instanceUrl===instanceUrl ? saved.token : '');
    const client=new EdgeEverClient({instanceUrl,token}); const notebooks=await client.notebooks();
    const notebookId=request.notebookId || (!request.token.trim() && saved?.instanceUrl===instanceUrl ? saved.notebookId : '');
    if(!notebookId || !notebooks.some(n=>n.id===notebookId)) return {instanceUrl,notebookId:'',notebooks,hasToken:false,needsNotebookSelection:true};
    await connectionStore({instanceUrl,token,notebookId,notebooks});
    return {instanceUrl,notebookId,notebooks,hasToken:true};
   }
   if(!saved) throw new Error('请先打开扩展设置，配置 EdgeEver 地址和 API Token。');
   validateClip(request.clip);
   if(saving) throw new Error('已有剪藏正在保存，请等待完成。');
   saving=true;
   try {return await saveClip(new EdgeEverClient(saved),{...request.clip,notebookId:request.clip.notebookId||saved.notebookId});} finally {saving=false;}
  })().then(result=>sendResponse({ok:true,result})).catch(error=>sendResponse({ok:false,error:error instanceof Error ? error.message : 'EdgeEver 保存失败。'}));
  return true;
 });
}
