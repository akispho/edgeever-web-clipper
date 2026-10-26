import browser from '../utils/browser-polyfill';
import type { Notebook } from '../utils/edgeever-client';
import { notebookLabel } from '../utils/edgeever-note-creator';
export interface PublicConnection {instanceUrl:string;notebookId:string;notebooks:Notebook[];hasToken:boolean;needsNotebookSelection?:boolean}
export async function destinationMessage(action:string,values:Record<string,unknown>={}):Promise<any> {
 const response:any=await browser.runtime.sendMessage({action,...values});
 if(!response?.ok) throw new Error(response?.error || '无法连接 EdgeEver 后台。'); return response.result;
}
export async function loadDestination():Promise<PublicConnection> { return destinationMessage('edgeever-connection'); }
export function notebookOptions(select:HTMLSelectElement,connection:PublicConnection,selected=connection.notebookId):void {
 select.textContent='';
 for(const notebook of connection.notebooks) {const option=document.createElement('option');option.value=notebook.id;option.textContent=notebookLabel(connection.notebooks,notebook.id);select.appendChild(option);}
 select.value=selected;
 if(selected && !connection.notebooks.some(n=>n.id===selected)) {const option=document.createElement('option');option.value=selected;option.textContent=`⚠ ${selected} (笔记本失效)`;select.appendChild(option);select.value=selected;}
}
export async function initializeEdgeEverSettings():Promise<void> {
 const url=document.getElementById('edgeever-url') as HTMLInputElement;
 const token=document.getElementById('edgeever-token') as HTMLInputElement;
 const notebook=document.getElementById('edgeever-notebook') as HTMLSelectElement;
 const button=document.getElementById('edgeever-connect') as HTMLButtonElement;
 const status=document.getElementById('edgeever-status')!;
 if(!url || !token || !notebook || !button) return;
 try {
  const connection=await loadDestination(); url.value=connection.instanceUrl; token.placeholder=connection.hasToken ? '已保存；留空沿用 / Leave blank to keep token' : 'API Token'; notebookOptions(notebook,connection);
 } catch {status.textContent='无法读取连接设置，请重新加载扩展。';}
 url.addEventListener('input',()=>{notebook.textContent='';});
 button.addEventListener('click',async()=>{
  button.disabled=true; status.textContent='连接中… / Connecting…';
  try {
   const connection=await destinationMessage('edgeever-configure',{instanceUrl:url.value,token:token.value,notebookId:notebook.value});
   notebookOptions(notebook,connection); url.value=connection.instanceUrl;
   if(connection.needsNotebookSelection) {status.textContent='已读取笔记本；请选择目标后再次点击保存。 / Select a notebook, then save again.';return;}
   token.value='';token.placeholder='已保存；留空沿用 / Leave blank to keep token';
   status.textContent='连接成功，设置已保存。重新打开剪藏窗口以使用最新笔记本。 / Connected and saved.';
  } catch(error) {status.textContent=error instanceof Error ? error.message : '连接失败。';} finally {button.disabled=false;}
 });
}
