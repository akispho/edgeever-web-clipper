import type { EdgeEverSettings, Notebook } from './edgeever-client';
export interface Connection extends EdgeEverSettings {notebookId:string;notebooks:Notebook[]}
// IndexedDB is scoped to the extension origin; page content scripts use the page's origin.
// Keep credentials out of storage.local, which the retained highlighter uses in content scripts.
export async function connectionStore(value?:Connection):Promise<Connection|undefined> {
 return new Promise((resolve,reject)=>{
  const open=indexedDB.open('edgeever-private',1);
  open.onupgradeneeded=()=>open.result.createObjectStore('connection');
  open.onerror=()=>reject(new Error('无法打开 EdgeEver 本地凭据存储。'));
  open.onsuccess=()=>{
   const db=open.result;
   const tx=db.transaction('connection',value ? 'readwrite' : 'readonly');
   const store=tx.objectStore('connection');
   const request=value ? store.put(value,'active') : store.get('active');
   tx.oncomplete=()=>{db.close();resolve(value || request.result);};
   tx.onabort=tx.onerror=()=>{db.close();reject(new Error('无法读取或保存 EdgeEver 连接设置。'));};
  };
 });
}
