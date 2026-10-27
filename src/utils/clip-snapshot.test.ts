import {it,expect} from 'vitest';
import {captureClipOperation} from './clip-snapshot';
it('freezes all capture fields and template behavior before an asynchronous save',async()=>{
 const template:any={behavior:'create',id:'one'};
 const fields={content:'original body',noteName:'Title',notebookId:'nb',path:'Articles',sourceUrl:'https://source.test'};
 const operation=captureClipOperation(template,fields);
 await Promise.resolve();template.behavior='overwrite';fields.content='different tab';fields.sourceUrl='https://other.test';
 expect(operation).toEqual({...fields,content:'original body',sourceUrl:'https://source.test',behavior:'create'});
});
it('copies tags before an asynchronous save',()=>{
 const tags=['clippings'];
 const operation=captureClipOperation({behavior:'create'},{content:'body',noteName:'Title',notebookId:'nb',path:'',sourceUrl:'https://source.test',tags});
 tags.push('later edit');
 expect(operation.tags).toEqual(['clippings']);
});
