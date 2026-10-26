// @vitest-environment jsdom
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import browser from '../utils/browser-polyfill';
import {initializeEdgeEverSettings} from './edgeever-settings';
const connection={instanceUrl:'https://notes.test',notebookId:'child',notebooks:[{id:'root',name:'Inbox',parentId:null},{id:'child',name:'Articles',parentId:'root'}],hasToken:true};
beforeEach(()=>{
 document.documentElement.innerHTML=readFileSync('src/settings.html','utf8');
 vi.restoreAllMocks();
});
describe('destination settings UI',()=>{
 it('shows notebook hierarchy and a token placeholder without retrieving the secret',async()=>{
  const send=vi.spyOn(browser.runtime,'sendMessage').mockResolvedValue({ok:true,result:connection} as any);
  await initializeEdgeEverSettings();
  expect((document.getElementById('edgeever-token') as HTMLInputElement).value).toBe('');
  expect((document.getElementById('edgeever-notebook') as HTMLSelectElement).selectedOptions[0].textContent).toBe('Inbox / Articles');
  expect(send).toHaveBeenCalledWith({action:'edgeever-connection'});
 });
 it('persists through the background and clears typed credentials after a successful connection',async()=>{
  const send=vi.spyOn(browser.runtime,'sendMessage').mockResolvedValue({ok:true,result:connection} as any);
  await initializeEdgeEverSettings();
  (document.getElementById('edgeever-token') as HTMLInputElement).value='new-token';
  document.getElementById('edgeever-connect')!.click();
  await vi.waitFor(()=>expect(document.getElementById('edgeever-status')!.textContent).toContain('Connected'));
  expect(send).toHaveBeenLastCalledWith({action:'edgeever-configure',instanceUrl:'https://notes.test',token:'new-token',notebookId:'child'});
  expect((document.getElementById('edgeever-token') as HTMLInputElement).value).toBe('');
 });
 it('keeps the form usable after failed authentication',async()=>{
  vi.spyOn(browser.runtime,'sendMessage').mockResolvedValueOnce({ok:true,result:connection} as any).mockResolvedValueOnce({ok:false,error:'EdgeEver HTTP 401'} as any);
  await initializeEdgeEverSettings();document.getElementById('edgeever-connect')!.click();
  await vi.waitFor(()=>expect(document.getElementById('edgeever-status')!.textContent).toContain('401'));
  expect((document.getElementById('edgeever-connect') as HTMLButtonElement).disabled).toBe(false);
 });
});
it('keeps a replacement token until an explicit workspace notebook is selected',async()=>{
 const send=vi.spyOn(browser.runtime,'sendMessage').mockResolvedValueOnce({ok:true,result:connection} as any).mockResolvedValueOnce({ok:true,result:{...connection,notebookId:'',notebooks:[{id:'b',name:'Workspace B',parentId:null}],needsNotebookSelection:true}} as any).mockResolvedValueOnce({ok:true,result:{...connection,notebookId:'b',notebooks:[{id:'b',name:'Workspace B',parentId:null}]}} as any);
 await initializeEdgeEverSettings();const token=document.getElementById('edgeever-token') as HTMLInputElement;token.value='workspace-b';document.getElementById('edgeever-connect')!.click();
 await vi.waitFor(()=>expect(document.getElementById('edgeever-status')!.textContent).toContain('Select a notebook'));
 expect(token.value).toBe('workspace-b');const notebook=document.getElementById('edgeever-notebook') as HTMLSelectElement;expect(notebook.value).toBe('');notebook.value='b';document.getElementById('edgeever-connect')!.click();
 await vi.waitFor(()=>expect(document.getElementById('edgeever-status')!.textContent).toContain('Connected'));
 expect(send).toHaveBeenLastCalledWith({action:'edgeever-configure',instanceUrl:'https://notes.test',token:'workspace-b',notebookId:'b'});expect(token.value).toBe('');
});
