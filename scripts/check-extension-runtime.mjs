import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';

const makeEvent=()=>({listeners:[],addListener(fn){this.listeners.push(fn);},removeListener(){}});
const area=()=>{
 const values={};
 return {onChanged:makeEvent(),get:async keys=>typeof keys==='string' ? {[keys]:values[keys]} : Array.isArray(keys) ? Object.fromEntries(keys.map(k=>[k,values[k]])) : {...keys,...values},set:async input=>Object.assign(values,input),remove:async keys=>{for(const key of [keys].flat()) delete values[key];}};
};
const tab={id:1,windowId:1,url:'https://example.org/article',title:'Runtime fixture'};
const extraction={content:'<article><h1>Runtime fixture</h1><p>Captured article body.</p></article>',selectedHtml:'',extractedContent:{},schemaOrgData:{},fullHtml:'<html><body>Captured article body.</body></html>',highlights:[],title:'Runtime fixture',author:'Fixture',description:'Runtime test',domain:'example.org',favicon:'',image:'',published:'',site:'Example',wordCount:4,language:'en',metaTags:[]};
function makeBrowser(){
 return {
  runtime:{id:'fixture',getURL:path=>'chrome-extension://fixture/'+path,getManifest:()=>({version:'0.1.1'}),onMessage:makeEvent(),onInstalled:makeEvent(),onConnect:makeEvent(),connect:()=>({onDisconnect:makeEvent(),onMessage:makeEvent(),postMessage(){}}),sendMessage:async request=>{
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
const popup=new JSDOM(readFileSync('dist/popup.html','utf8'),{url:'https://fixture.test/popup.html',runScripts:'outside-only',pretendToBeVisual:true});
try {
 await new Promise(resolve=>popup.window.addEventListener('DOMContentLoaded',resolve,{once:true}));
 popup.window.browser=makeBrowser();popup.window.chrome=popup.window.browser;
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
 console.log('Popup runtime PASS: templates, save label and captured body render without configured credentials.');
} finally {popup.window.close();}

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
