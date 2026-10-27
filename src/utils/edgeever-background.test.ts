import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import browser from './browser-polyfill';
import { connectionStore } from './edgeever-connection';
import { registerEdgeEverDestination, trustedDestinationPage } from './edgeever-background';
vi.mock('./edgeever-connection',()=>({connectionStore:vi.fn()}));
beforeEach(()=>vi.mocked(connectionStore).mockReset());
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('destination message boundary',()=>{
 it('only accepts exact extension destination pages including embedded popup queries',()=>{
  const base='chrome-extension://ours/';
  for(const path of ['popup.html','popup.html?context=iframe','settings.html','side-panel.html']) expect(trustedDestinationPage(base+path,base)).toBe(true);
  for(const url of [undefined,'https://site.test/settings.html','https://site.test/chrome-extension://ours/popup.html',base+'content.js',base+'settings.html.evil']) expect(trustedDestinationPage(url,base)).toBe(false);
 });
});

describe('explicit notebook creation',()=>{
 async function send(request:any,url=browser.runtime.getURL('popup.html')) {
  const listener=vi.spyOn(browser.runtime.onMessage,'addListener');
  registerEdgeEverDestination();
  const handler=listener.mock.calls[listener.mock.calls.length-1]![0];
  return new Promise<any>((resolve,reject)=>{if(handler(request,{url} as any,resolve)!==true) reject(new Error('Notebook creation message was not handled'));});
 }
 it('creates under the selected parent, refreshes cached notebooks and never returns credentials',async()=>{
  const saved={instanceUrl:'https://notes.test',token:'private-token',notebookId:'nb',notebooks:[{id:'nb',name:'Inbox',parentId:null}]};
  vi.mocked(connectionStore).mockResolvedValue(saved);
  const notebooks=[...saved.notebooks];const writes:any[]=[];
  vi.stubGlobal('fetch',async (_url:string,init:RequestInit={})=>{
   if(init.method==='POST') {const body=JSON.parse(init.body as string);writes.push(body);const notebook={id:'child',...body};notebooks.push(notebook);return Response.json({notebook});}
   return Response.json({notebooks});
  });
  const response=await send({action:'edgeever-create-notebook',parentId:'nb',name:' Travel '});
  expect(response).toEqual({ok:true,result:{notebookId:'child',notebooks}});
  expect(writes).toEqual([{name:'Travel',parentId:'nb'}]);
  expect(connectionStore).toHaveBeenLastCalledWith({...saved,notebooks});
  expect(JSON.stringify(response)).not.toContain('private-token');
 });
 it.each(['','..','a/b','a\\b','x'.repeat(81),42])('rejects invalid child name %s before making any request',async name=>{
  vi.mocked(connectionStore).mockResolvedValue({instanceUrl:'https://notes.test',token:'secret',notebookId:'nb',notebooks:[]});
  const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);
  expect((await send({action:'edgeever-create-notebook',parentId:'nb',name})).ok).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
 });
 it('does not create a child under a stale parent or accept a web-page sender',async()=>{
  vi.mocked(connectionStore).mockResolvedValue({instanceUrl:'https://notes.test',token:'secret',notebookId:'nb',notebooks:[]});
  const fetchMock=vi.fn().mockResolvedValue(Response.json({notebooks:[]}));vi.stubGlobal('fetch',fetchMock);
  expect((await send({action:'edgeever-create-notebook',parentId:'missing',name:'Travel'})).ok).toBe(false);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect((await send({action:'edgeever-create-notebook',parentId:'nb',name:'Travel'},'https://page.test')).ok).toBe(false);
  expect(fetchMock).toHaveBeenCalledTimes(1);
 });
 it('reuses an existing child and does not overwrite a connection changed during the request',async()=>{
  const notebooks=[{id:'nb',name:'Inbox',parentId:null},{id:'child',name:'Travel',parentId:'nb'}];
  const saved={instanceUrl:'https://notes.test',token:'old-secret',notebookId:'nb',notebooks};
  vi.mocked(connectionStore).mockResolvedValueOnce(saved).mockResolvedValueOnce({...saved,token:'new-secret'});
  const fetchMock=vi.fn().mockImplementation(async(_url:string,_init:RequestInit={})=>Response.json({notebooks}));vi.stubGlobal('fetch',fetchMock);
  expect((await send({action:'edgeever-create-notebook',parentId:'nb',name:'Travel'})).result.notebookId).toBe('child');
  expect(fetchMock.mock.calls.every(([,init])=>init?.method!== 'POST')).toBe(true);
  expect(vi.mocked(connectionStore).mock.calls).toEqual([[],[]]);
 });
});

// Isolate the protocol from native persistence; the production IndexedDB transaction
// is also exercised by the standalone browser roundtrip check.
