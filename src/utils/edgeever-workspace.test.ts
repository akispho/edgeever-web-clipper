import {it,expect,vi,afterEach} from 'vitest';
import browser from './browser-polyfill';
const store=vi.hoisted(()=>vi.fn());
vi.mock('./edgeever-connection',()=>({connectionStore:store}));
import {registerEdgeEverDestination} from './edgeever-background';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();store.mockReset();});
it('returns fresh notebook choices without rebinding when the Token changes workspace',async()=>{
 const previous={instanceUrl:'https://notes.test',token:'workspace-a',notebookId:'a',notebooks:[{id:'a',name:'A',parentId:null}]};
 store.mockResolvedValue(previous);
 vi.stubGlobal('fetch',async()=>Response.json({notebooks:[{id:'b',name:'B',parentId:null}]}));
 let listener:any;vi.spyOn(browser.runtime.onMessage,'addListener').mockImplementation((callback:any)=>{listener=callback;});
 registerEdgeEverDestination();
 const call=(request:any)=>new Promise<any>(resolve=>listener(request,{url:'chrome-extension://mock-id/settings.html'},resolve));
 const first=await call({action:'edgeever-configure',instanceUrl:'https://notes.test',token:'workspace-b',notebookId:'a'});
 expect(first).toMatchObject({ok:true,result:{needsNotebookSelection:true,notebookId:'',notebooks:[{id:'b'}]}});
 expect(store.mock.calls.every(args=>args.length===0)).toBe(true);
 const second=await call({action:'edgeever-configure',instanceUrl:'https://notes.test',token:'workspace-b',notebookId:'b'});
 expect(second).toMatchObject({ok:true,result:{notebookId:'b'}});expect(store).toHaveBeenLastCalledWith(expect.objectContaining({token:'workspace-b',notebookId:'b'}));
});
