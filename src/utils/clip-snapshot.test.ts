import {it,expect} from 'vitest';
import {captureClipOperation} from './clip-snapshot';
it('freezes all capture fields and template behavior before an asynchronous save',async()=>{
 const template:any={behavior:'create',id:'one'};
 const fields={content:'original body',noteName:'Title',notebookId:'nb',path:'Articles',sourceUrl:'https://source.test'};
 const operation=captureClipOperation(template,fields);
 await Promise.resolve();template.behavior='overwrite';fields.content='different tab';fields.sourceUrl='https://other.test';
 expect(operation).toEqual({...fields,content:'original body',sourceUrl:'https://source.test',behavior:'create'});
});
