import test from 'node:test';
import assert from 'node:assert/strict';
import {checkedCommentClassifications,checkedCommentPage,startCommentSweep,advanceCommentSweep,wantsCommentSweep} from '../src/api/assistant-sweep.ts';
const row={id:1,name:'Author',body:'Comment',account:'Macro',classification:'spam' as const,reason:'Third-party ad',reply_available:false};
test('comment scans continue beyond 20, count unique IDs, pause and resume from saved progress',()=>{
 let state=startCommentSweep('Classify all comments');
 for(let batch=0;batch<51;batch++){
  const rows=Array.from({length:20},(_,i)=>({...row,id:batch*20+i+1}));
  state=advanceCommentSweep(state,rows,batch<50?{cursor:'cursor'+batch,filters:{queue:'all'}}:null);
  if(batch===4)state=JSON.parse(JSON.stringify({...state,status:'paused'}));
 }
 assert.equal(state.seen.length,1020);assert.equal(state.spam,1020);assert.equal(state.status,'complete');
 state=advanceCommentSweep(state,[row],null);assert.equal(state.spam,1020);
});
test('repeated pagination and malformed classification fail instead of claiming completion',()=>{
 const page={cursor:'same',filters:{}};const state=advanceCommentSweep(startCommentSweep('All comments'),[row],page);
 assert.throws(()=>advanceCommentSweep(state,[row],page));
 assert.throws(()=>checkedCommentClassifications([row,row]));
 assert.throws(()=>checkedCommentClassifications([{...row,classification:'delete'}]));
 assert.throws(()=>checkedCommentPage({cursor:'',filters:{}}));
 assert.deepEqual(checkedCommentClassifications([row]),[row]);
 assert.equal(checkedCommentPage(null),null);
});
test('only explicit requests to scan all comments opt into continuous reading',()=>{
 assert.equal(wantsCommentSweep('Varra todos os comentários e classifique spam'),true);
 assert.equal(wantsCommentSweep('Scan all comments'),true);
 assert.equal(wantsCommentSweep('Todos os comentários de spam'),true);
 assert.equal(wantsCommentSweep('Responda este comentário'),false);
 assert.equal(wantsCommentSweep('Todas as campanhas'),false);
});
