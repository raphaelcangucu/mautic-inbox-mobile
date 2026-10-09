import test from 'node:test';
import assert from 'node:assert/strict';
import {moderateSelection,mergeModeration,canModerateConversation} from '../src/api/moderation.ts';
import type {Conversation,Transport} from '../src/api/types.ts';

const comment=(id:number,recipient='author')=>({id,kind:'comments',channel:'instagram',asset:{id:4},recipient,version:1,moderation:{spam:false,hidden:false,blockedAuthor:false}} as Conversation);
test('WebChat moderation requires server capability and never enables unsupported private social chats',()=>{
 const webchat={...comment(10),kind:'inbox',channel:'webchat'} as Conversation;
 assert.equal(canModerateConversation(webchat),false);
 assert.equal(canModerateConversation({...webchat,moderation_available:true}),true);
 assert.equal(canModerateConversation({...webchat,moderation_available:false}),false);
 assert.equal(canModerateConversation({...comment(11),kind:'inbox',moderation_available:true}),false);
 assert.equal(canModerateConversation(comment(12)),true);
 assert.equal(canModerateConversation({...comment(12),moderation_available:false}),false);
});
test('WebChat blocking reaches only the same visitor and widget, preserving other channels',()=>{
 const webchat=(id:number,asset=17,recipient='visitor')=>({...comment(id,recipient),kind:'inbox',channel:'webchat',asset:{id:asset},moderation_available:true} as Conversation);
 const current=webchat(10);const same=webchat(11);const otherWidget=webchat(12,18);const otherVisitor=webchat(13,17,'another');const social=comment(14,'visitor');
 const fresh={...current,moderation:{spam:false,hidden:false,blockedAuthor:true}};
 const merged=mergeModeration([current,same,otherWidget,otherVisitor,social],fresh);
 assert.equal(merged[0],fresh);assert.equal(merged[1].moderation?.blockedAuthor,true);
 assert.equal(merged[2],otherWidget);assert.equal(merged[3],otherVisitor);assert.equal(merged[4],social);
});
function fake(rows:Conversation[]){
 const calls:any[]=[];const data=new Map(rows.map(c=>[c.id,c]));const authors=new Set<string>();
 const api={request:async(input:any)=>{calls.push(input);const id=Number(input.path.split('/')[4]);let row=data.get(id)!;if(input.method==='POST'){row={...row,moderation:{...row.moderation!,[input.body.action==='spam'?'spam':input.body.action==='hide'?'hidden':'blockedAuthor']:true}};data.set(id,row);if(input.body.action==='block')authors.add(row.recipient);}
 return {...row,moderation:{...row.moderation!,blockedAuthor:authors.has(row.recipient)}};}} as Transport;
 return {api,calls};
}
test('moderates reviewed comments, deduplicates authors and skips private conversations',async()=>{
 const rows=[comment(1),comment(2),{...comment(3),kind:'inbox'} as Conversation];const {api,calls}=fake(rows);
 const result=await moderateSelection(api,[...rows,rows[0]],'spam_block',()=>true,async()=>{},()=>{});
 assert.equal(result.done,2);assert.equal(result.failures.length,0);
 assert.deepEqual(calls.filter(c=>c.method==='POST').map(c=>c.body.action),['spam','block','spam']);
 assert.equal(calls.some(c=>c.path.includes('/3')),false);
});
test('rejects an author or account change before writing',async()=>{
 let writes=0;const api={request:async(input:any)=>{if(input.method==='POST')writes++;return comment(1,'different-author');}} as Transport;
 const result=await moderateSelection(api,[comment(1)],'spam',()=>true,async()=>{},()=>{});
 assert.equal(writes,0);assert.equal(result.failures.length,1);
});
test('stops after the active account changes while reading',async()=>{
 let valid=true;let writes=0;const api={request:async(input:any)=>{if(input.method==='POST')writes++;valid=false;return comment(1);}} as Transport;
 await moderateSelection(api,[comment(1)],'spam_block',()=>valid,async()=>{},()=>{});
 assert.equal(writes,0);
});
test('reports partial failures without undoing successful moderation',async()=>{
 const {api,calls}=fake([comment(1),comment(2)]);const request=api.request.bind(api);
 api.request=async(input:any)=>{if(input.path.includes('/2'))throw new Error('Não autorizado');return request(input);};
 const result=await moderateSelection(api,[comment(1),comment(2)],'spam',()=>true,async()=>{},()=>{});
 assert.equal(result.done,1);assert.equal(result.failures[0].id,2);assert.equal(calls.filter(c=>c.method==='POST').length,1);
});
test('hiding uses at most three independent requests and preserves confirmed hidden comments',async()=>{
 const rows=[comment(1),comment(2),comment(3),comment(4),{...comment(5),moderation:{spam:true,hidden:true,blockedAuthor:true}}];
 const {api,calls}=fake(rows);const request=api.request.bind(api);let active=0;let maxActive=0;
 api.request=async(input:any)=>{if(input.method!=='POST')return request(input);active++;maxActive=Math.max(maxActive,active);await new Promise<void>(resolve=>setImmediate(resolve));try{return await request(input)}finally{active--}};
 const saved:Conversation[]=[];const result=await moderateSelection(api,rows,'hide',()=>true,async c=>{saved.push(c)},()=>{});
 assert.equal(result.done,4);assert.equal(result.failures.length,0);assert.ok(maxActive<=3);assert.ok(maxActive>1);
 assert.ok(saved.every(c=>c.moderation?.hidden));assert.equal(calls.some(c=>c.path.includes('/5')),false);
 assert.ok(calls.filter(c=>c.method==='POST').every(c=>c.body.action==='hide'));
});
test('Instagram hiding cannot be applied to a Facebook comment',async()=>{
 const row={...comment(1),channel:'facebook'} as Conversation;const {api,calls}=fake([row]);
 const result=await moderateSelection(api,[row],'hide',()=>true,async()=>{},()=>{});
 assert.equal(result.failures.length,1);assert.equal(calls.filter(c=>c.method==='POST').length,0);
});
test('author blocking preserves private messages and other accounts',()=>{
 const current=comment(1);const other=comment(2);const privateMessage={...comment(3),kind:'inbox'} as Conversation;const anotherAccount={...comment(4),asset:{id:5}} as Conversation;
 const fresh={...current,moderation:{spam:true,hidden:true,blockedAuthor:true}};
 const merged=mergeModeration([current,other,privateMessage,anotherAccount],fresh);
 assert.equal(merged[0],fresh);assert.equal(merged[1].moderation?.blockedAuthor,true);
 assert.equal(merged[2],privateMessage);assert.equal(merged[3],anotherAccount);
});
test('rejects an unexpected conversation ID even when the author matches',async()=>{
 const {api,calls}=fake([comment(2)]);const request=api.request.bind(api);api.request=async input=>request({...input,path:input.path.replace('/1','/2')});
 const result=await moderateSelection(api,[comment(1)],'spam',()=>true,async()=>{},()=>{});
 assert.equal(result.failures.length,1);assert.equal(calls.filter(c=>c.method==='POST').length,0);
});
