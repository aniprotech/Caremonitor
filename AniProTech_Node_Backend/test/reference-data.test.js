import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db.js';
import { initializeReferenceData, importSnapshot, validateSnapshot } from '../src/reference-data.js';
import { draftHandover, missingInformation, paymentExplanation } from '../src/services/assistance.js';
const snapshot={source:'scotland-hospitals',release:'test-1',sourceUrl:'https://www.opendata.nhs.scot/',records:[{code:'001',name:'Example Hospital',kind:'hospital',country:'Scotland'}]};
test('reference import is idempotent, preserves string codes and rejects duplicates without losing current data',async()=>{
 const db=await openDatabase({driver:'pglite',dataDir:':memory:'});
 try {
  await initializeReferenceData(db);
  assert.equal((await importSnapshot(db,snapshot,'one')).count,1);
  assert.equal((await importSnapshot(db,snapshot,'one')).unchanged,true);
  await assert.rejects(importSnapshot(db,{...snapshot,records:[...snapshot.records,...snapshot.records]},'bad'));
  assert.equal((await db.query('SELECT code FROM node_reference_terms')).rows[0].code,'001');
  assert.throws(()=>validateSnapshot({...snapshot,records:[]}));
  assert.throws(()=>validateSnapshot({...snapshot,records:[{...snapshot.records[0],kind:'medicine'}]}));
 } finally {await db.close();}
});
test('handover drafts preserve source text and IDs without inventing conclusions',()=>{
 const row={id:'source-1',kind:'NOTE',title:'Visit',body:'Client reports no pain.',createdAt:'2026-10-05T09:00:00Z'};
 const draft=draftHandover([row]);assert.match(draft.suggestion,/Client reports no pain/);assert.equal(draft.evidence[0].entryId,row.id);
 assert.equal(missingInformation({firstName:'A',lastName:'B',primaryPhone:'0123'}).length,0);
 assert.equal(missingInformation({firstName:'A'}).length,2);
 assert.match(paymentExplanation({amountPence:500,isSandbox:true},[{}]),/cannot settle/);
 assert.match(paymentExplanation({amountPence:500},[{},{}]),/Several/);
});
