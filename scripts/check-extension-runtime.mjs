import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import LZString from 'lz-string';

const makeEvent=()=>({listeners:[],addListener(fn){this.listeners.push(fn);},removeListener(){}});
const area=()=>{
 const values={};
 return {onChanged:makeEvent(),get:async keys=>typeof keys==='string' ? {[keys]:values[keys]} : Array.isArray(keys) ? Object.fromEntries(keys.map(k=>[k,values[k]])) : {...keys,...values},set:async input=>Object.assign(values,input),remove:async keys=>{for(const key of [keys].flat()) delete values[key];}};
};
const tab={id:1,windowId:1,url:'https://example.org/article',title:'Runtime fixture'};
const extraction={content:'<article><h1>Runtime fixture</h1><p>Captured article body.</p></article>',selectedHtml:'',extractedContent:{},schemaOrgData:{},fullHtml:'<html><body>Captured article body.</body></html>',highlights:[],title:'Runtime fixture',author:'Fixture',description:'Runtime test',domain:'example.org',favicon:'',image:'',published:'',site:'Example',wordCount:4,language:'en',metaTags:[]};
function makeBrowser(){
 return {
  runtime:{id:'fixture',getURL:path=>'chrome-extension://fixture/'+path,getManifest:()=>({version:JSON.parse(readFileSync('package.json','utf8')).version}),onMessage:makeEvent(),onInstalled:makeEvent(),onConnect:makeEvent(),connect:()=>({onDisconnect:makeEvent(),onMessage:makeEvent(),postMessage(){}}),sendMessage:async request=>{
   switch(request.action){
    case 'getActiveTab':return {tabId:1};
    case 'getTabInfo':return {success:true,tab};
    case 'edgeever-connection':return {ok:true,result:{instanceUrl:'',notebookId:'',notebooks:[],hasToken:false}};
    case 'sendMessageToTab':return extraction;
    default:return {success:true,isActive:false};
   }
  }},
  tabs:{onUpdated:makeEvent(),onActivated:makeEvent(),onRemoved:makeEvent(),query:async()=>[tab],get:async()=>tab,sendMessage:async()=>({}),update:async()=>tab},
  commands:{onCommand:makeEvent()},contextMenus:{onClicked:makeEvent(),removeAll:async()=>{},create:async()=>{}},
  action:{onClicked:makeEvent(),setPopup:async()=>{}},declarativeNetRequest:{updateSessionRules:async()=>{}},
  storage:{onChanged:makeEvent(),local:area(),sync:area()},i18n:{getMessage:key=>key,getUILanguage:()=> 'en'}
 };
}

// Execute the shipped worker bundle without a document/window. Unit tests resolve
// Node export conditions, so they cannot catch a DOM-only browser dependency here.
const workerBrowser=makeBrowser();
vm.runInNewContext(readFileSync('dist/background.js','utf8'),{
 browser:workerBrowser,chrome:workerBrowser,console,URL,URLSearchParams,TextDecoder,TextEncoder,AbortSignal,fetch,setTimeout,clearTimeout
},{filename:'background.js',timeout:10000});
assert.ok(workerBrowser.runtime.onMessage.listeners.length>=3,'Worker failed to register destination and tab handlers');
console.log('Worker runtime PASS: shipped background bundle boots without a DOM.');

// Exercise the shipped popup bundle and real template/UI code against synthetic
// WebExtension boundaries; this is not a real-profile or live-instance test.
for(const popupPage of ['popup.html','side-panel.html']) {
const popup=new JSDOM(readFileSync('dist/'+popupPage,'utf8'),{url:'https://fixture.test/popup.html',runScripts:'outside-only',pretendToBeVisual:true});
try {
 await new Promise(resolve=>popup.window.addEventListener('DOMContentLoaded',resolve,{once:true}));
 popup.window.browser=makeBrowser();popup.window.chrome=popup.window.browser;
 const legacyTemplate={id:'legacy',name:'Default',vault:'other',behavior:'create',noteNameFormat:'{{title}}',path:'Clippings',noteContentFormat:'{{content}}',context:'',properties:[{id:'tags',name:'tags',value:'clippings'}],triggers:[]};
 await popup.window.browser.storage.sync.set({template_list:['legacy'],template_legacy:[LZString.compressToUTF16(JSON.stringify(legacyTemplate))]});
 const messages=[]; const creations=[]; let finishSave,finishCreate;
 const originalSend=popup.window.browser.runtime.sendMessage;
 popup.window.browser.runtime.sendMessage=async request=>{
  if(request.action==='edgeever-connection') return {ok:true,result:{instanceUrl:'https://notes.test',notebookId:'nb',notebooks:[{id:'nb',name:'Inbox',parentId:null},{id:'other',name:'Work',parentId:null}],hasToken:true}};
  if(request.action==='edgeever-create-notebook') {creations.push(request);return new Promise(resolve=>{finishCreate=resolve;});}
  if(request.action==='edgeever-save') {messages.push(request.clip);return new Promise(resolve=>{finishSave=resolve;});}
  return originalSend(request);
 };
 popup.window.structuredClone=structuredClone;
 popup.window.eval(readFileSync('dist/popup.js','utf8'));
 popup.window.document.dispatchEvent(new popup.window.Event('DOMContentLoaded'));
 const deadline=Date.now()+5000;
 while(Date.now()<deadline && !popup.window.document.querySelector('#note-content-field').value.includes('Captured article body.')) await new Promise(resolve=>setTimeout(resolve,20));
 const doc=popup.window.document;
 assert.ok(doc.querySelector('#template-select').options.length>0,'Popup has no templates');
 assert.ok(doc.querySelector('#clip-btn').textContent.includes('EdgeEver'),'Popup save action has no label');
 assert.ok(doc.querySelector('#note-content-field').value.includes('Captured article body.'),'Popup failed to render extracted content: '+doc.querySelector('.error-message').textContent);
 assert.notEqual(doc.querySelector('.clipper').style.display,'none');
 const path=doc.querySelector('#path-name-field');
 const form=doc.querySelector('#notebook-create-form');
 const select=doc.querySelector('#vault-select');
 const create=doc.querySelector('#notebook-create-confirm');
 const cancel=doc.querySelector('#notebook-create-cancel');
 const openCreate=()=>{select.value='';select.dispatchEvent(new popup.window.Event('change'));};
 const button=doc.querySelector('#clip-btn');
 const status=doc.querySelector('#destination-status');
 assert.equal(path.value,'','Legacy Clippings path must not be applied automatically');
 assert.equal(path.disabled,true);
 assert.equal(form.hidden,true);
 assert.equal(select.options[select.options.length-1].value,'');
 assert.ok(select.options[select.options.length-1].textContent.includes('New sub-notebook'));
 assert.equal(doc.querySelector('#create-subnotebook'),null);
 assert.ok(doc.querySelector('.clipper-footer').contains(status),'Save status must be next to the action');
 assert.equal(status.nextElementSibling.id,'action-buttons');
 doc.querySelector('.metadata-property input#tags').value='clippings,travel';
 const waitFor=async predicate=>{const deadline=Date.now()+3000;while(!predicate() && Date.now()<deadline) await new Promise(resolve=>setTimeout(resolve,10));assert.ok(predicate(),'Timed out waiting for save UI');};
 button.click();
 await waitFor(()=>messages.length===1);
 assert.equal(button.disabled,true);
 assert.ok(button.textContent.includes('Saving'));
 assert.equal(status.dataset.state,'saving');
 assert.equal(messages[0].notebookId,'other');
 assert.equal(messages[0].path,'');
 assert.deepEqual(Array.from(messages[0].tags),['clippings','travel']);
 finishSave({ok:true,result:{memoId:'m',images:0,totalImages:0}});
 await waitFor(()=>status.dataset.state==='success');
 assert.equal(button.disabled,false);
 openCreate();
 assert.equal(form.hidden,false);
 assert.equal(path.disabled,false);
 assert.equal(select.value,'other','New child uses the template-selected notebook, not the initial default');
 assert.equal(button.disabled,true);
 path.value='Cancel me';cancel.click();
 assert.equal(form.hidden,true);
 assert.equal(path.value,'');
 assert.equal(button.disabled,false);
 assert.equal(creations.length,0);
 openCreate();
 select.value='nb';select.dispatchEvent(new popup.window.Event('change'));
 assert.equal(form.hidden,true,'Selecting an existing notebook closes child creation');
 openCreate();create.click();
 await waitFor(()=>status.dataset.state==='error');
 assert.equal(creations.length,0,'Blank names must not create a notebook');
 path.value='Travel';
 path.dispatchEvent(new popup.window.KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true}));
 assert.equal(creations.length,0,'IME confirmation must not create a notebook');
 path.dispatchEvent(new popup.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
 await waitFor(()=>creations.length===1);
 assert.equal(select.disabled,true);assert.equal(cancel.disabled,true);assert.equal(button.disabled,true);
 assert.equal(creations[0].parentId,'nb');assert.equal(creations[0].name,'Travel');
 finishCreate({ok:false,error:'Synthetic permission failure'});
 await waitFor(()=>!create.disabled);
 assert.equal(status.dataset.state,'error');
 assert.equal(form.hidden,false);assert.equal(path.value,'Travel');assert.equal(select.value,'nb');
 create.click();
 await waitFor(()=>creations.length===2);
 finishCreate({ok:true,result:{notebookId:'child',notebooks:[{id:'nb',name:'Inbox',parentId:null},{id:'child',name:'Travel',parentId:'nb'}]}});
 await waitFor(()=>form.hidden && !button.disabled);
 assert.equal(doc.activeElement,select,'Creation returns keyboard focus to the notebook selector');
 assert.equal(select.value,'child');assert.equal(path.value,'');
 assert.equal(messages.length,1,'Creating a notebook must not save a note');
 button.click();
 await waitFor(()=>messages.length===2);
 assert.equal(messages[1].notebookId,'child');assert.equal(messages[1].path,'');
 finishSave({ok:true,result:{memoId:'m2',images:0,totalImages:1,warning:'Image retained remotely'}});
 await waitFor(()=>status.dataset.state==='warning');
 assert.equal(status.textContent,'Image retained remotely');
 openCreate();
 assert.equal(select.value,'child','Repeated openings retain the current parent');
 path.dispatchEvent(new popup.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 assert.equal(form.hidden,true);assert.equal(select.value,'child');
 console.log('Popup runtime PASS: compact notebook menu, cancel, validation, creation failure/retry, automatic child selection, native tags and adjacent save status.');
} finally {popup.window.close();}
}

const failedPopup=new JSDOM(readFileSync('dist/popup.html','utf8'),{url:'https://fixture.test/popup.html',runScripts:'outside-only'});
const rejected=[];
const captureRejection=error=>rejected.push(error);
process.on('unhandledRejection',captureRejection);
try {
 await new Promise(resolve=>failedPopup.window.addEventListener('DOMContentLoaded',resolve,{once:true}));
 const browser=makeBrowser();browser.storage.sync.get=async()=>{throw new Error('Synthetic storage read failure');};
 failedPopup.window.browser=browser;failedPopup.window.chrome=browser;
 failedPopup.window.eval(readFileSync('dist/popup.js','utf8'));
 failedPopup.window.document.dispatchEvent(new failedPopup.window.Event('DOMContentLoaded'));
 await new Promise(resolve=>setTimeout(resolve,100));
 assert.equal(rejected.length,0,'Popup initialization rejected outside its error handler');
 assert.ok(failedPopup.window.document.querySelector('.error-message').textContent.trim(),'Storage failure left the popup blank');
 assert.equal(failedPopup.window.document.querySelector('.clipper').style.display,'none');
 console.log('Popup failure handling PASS: storage initialization errors show a visible message.');
} finally {failedPopup.window.close();process.removeListener('unhandledRejection',captureRejection);}
