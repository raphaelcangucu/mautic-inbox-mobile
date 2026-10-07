import test from 'node:test';import assert from 'node:assert/strict';
import {conversationFromApi} from '../src/api/http.ts';
import {initialReplyMode,replyState,replyAccess} from '../src/api/reply-mode.ts';
test('ordinary conversations always use private replies after a public comment',()=>{
 const comment=conversationFromApi({id:1,kind:'comments',channel:'instagram',reply_modes:{public:{available:true,can_reply:true,blocked_reason:null}}});
 assert.equal(initialReplyMode(comment),'public');
 for(const channel of ['webchat','whatsapp','instagram','facebook','email']){
  const conversation=conversationFromApi({id:2,kind:'private',channel,recipient:'test-recipient',can_reply:true});
  assert.equal(initialReplyMode(conversation),'private',channel);
 }
 assert.equal(initialReplyMode(undefined),'private','missing cache must not select a public reply');
});
test('expired Instagram private window does not block authorized public response',()=>{
 const c=conversationFromApi({id:1,kind:'comments',channel:'instagram',can_reply:false,reply_blocked_reason:'Private window closed',reply_modes:{public:{available:true,can_reply:true,blocked_reason:null},private:{available:false,can_reply:false,blocked_reason:'Private window closed'}}});
 assert.equal(c.comment?.canPublic,true);assert.equal(initialReplyMode(c),'public');assert.equal(replyState(c,'public').can_reply,true);assert.equal(replyState(c,'public').blocked_reason,null);assert.equal(replyState(c,'private').can_reply,false);
});
test('public response still respects assignment and server permission denial',()=>{
 const c=conversationFromApi({id:1,kind:'comments',channel:'instagram',can_reply:false,reply_modes:{public:{available:true,can_reply:false,blocked_reason:null}}});
 assert.equal(replyState(c,'public').can_reply,false);
 const moderated={...c,reply_modes:{public:{available:false,can_reply:false,blocked_reason:'Unavailable'}}};
 assert.equal(replyState(moderated,'public').available,false);
});
test('older API instances preserve private-only Instagram support',()=>{
 const c=conversationFromApi({id:1,kind:'comments',channel:'instagram',can_reply:false,reply_blocked_reason:'Expired'});
 assert.equal(c.comment?.canPublic,false);assert.equal(initialReplyMode(c),'private');assert.equal(replyState(c,'private').can_reply,false);
});
test('partial list updates retain known explicit mode availability',()=>{
 const c=conversationFromApi({id:1,kind:'comments',channel:'instagram',reply_modes:{public:{available:true,can_reply:true,blocked_reason:null}}});
 const fresh=conversationFromApi({id:1,kind:'comments',channel:'instagram'},c);
 assert.equal(fresh.comment?.canPublic,true);assert.equal(replyState(fresh,'public').can_reply,true);
});
test('assignment exposes a take action without enabling another operator reply',()=>{
 const c=conversationFromApi({id:269,channel:'whatsapp',assignee:{id:1,name:'Mautic Admin'},can_reply:false,can_take:true,reply_blocked_reason:null});
 const access=replyAccess(c,'private',8,true);
 assert.equal(access.blocked,true);assert.equal(access.take,true);assert.match(access.reason!,/Mautic Admin/);
 const transferred=conversationFromApi({id:269,channel:'whatsapp',assignee:{id:8,name:'Raphael'},can_reply:true,reply_blocked_reason:null},c);
 assert.equal(replyAccess(transferred,'private',8,true).blocked,false);
 assert.equal(replyAccess(transferred,'private',8,true).take,false);
});
test('ordinary operators and permission denials keep clear reasons',()=>{
 const c=conversationFromApi({id:1,channel:'facebook',assignee:{id:1,name:'Other operator'},can_reply:false,can_take:false,reply_blocked_reason:null});
 assert.equal(replyAccess(c,'private',8,true).take,false);
 assert.match(replyAccess(c,'private',8,true).reason!,/transferência/);
 const mine={...c,assignee:{id:8,name:'Raphael'}};
 assert.match(replyAccess(mine,'private',8,true).reason!,/permissão/);
});
test('a real null availability reason clears a cached closed window across channels',()=>{
 for(const channel of ['whatsapp','webchat','facebook','instagram']){
  const old=conversationFromApi({id:1,channel,can_reply:false,reply_blocked_reason:'Window closed'});
  const still=conversationFromApi({id:1,channel,preview:'partial list'},old);
  assert.equal(still.mobile.window_open,false);
  const fresh=conversationFromApi({id:1,channel,can_reply:true,reply_blocked_reason:null},old);
  assert.equal(fresh.reply_blocked_reason,null);assert.equal(fresh.mobile.window_open,true);
  assert.equal(replyAccess(fresh,'private',8,true).blocked,false);
 }
});
test('channel restrictions and moderation survive permission to take',()=>{
 const c=conversationFromApi({id:1,channel:'whatsapp',can_reply:false,can_take:true,reply_blocked_reason:'Window closed'});
 assert.equal(replyAccess(c,'private',8,true).blocked,true);assert.equal(replyAccess(c,'private',8,true).reason,'Window closed');
 assert.match(replyAccess({...c,moderation:{spam:true,blockedAuthor:false,hidden:false}},'private',8,true).reason!,/spam/);
});
