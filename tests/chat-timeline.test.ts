import {test} from 'node:test';
import assert from 'node:assert/strict';
import {visibleChatMessages,groupChatMessages} from '../src/components/chat-timeline.ts';
import type {Message} from '../src/api/types.ts';
const message=(id:number,patch:Partial<Message>={}):Message=>({id,kind:'message',body:'Mensagem',direction:'inbound',timestamp:'2026-10-06T08:00:00Z',...patch});
test('blank server audit events consume no display space without deleting stored history or attachment messages',()=>{
 const rows=[message(1),message(2,{kind:'event',body:''}),message(3,{kind:'event',body:'  '}),message(4,{kind:'event',body:'Atendimento transferido'}),message(5,{body:'',attachment:{name:'Arquivo',mime:'application/pdf'}})];
 assert.deepEqual(visibleChatMessages(rows).map(m=>m.id),[1,4,5]);
 assert.equal(rows.length,5);assert.equal(rows[1].kind,'event');
 assert.equal(visibleChatMessages([...rows,message(6,{kind:'event',body:''})]).at(-1)?.id,5);
});
test('grouping respects sender, time, day, audience and audit boundaries',()=>{
 const first=message(1,{author:'Contato'}),next=message(2,{author:'Contato',timestamp:'2026-10-06T08:01:00Z'});
 assert.equal(groupChatMessages(first,next),true);
 for(const patch of [{author:'Outro'},{direction:'outbound' as const},{kind:'note' as const},{kind:'event' as const},{replyMode:'private' as const},{ai:'Assistente'},{timestamp:'2026-10-06T08:06:00Z'},{timestamp:'2026-10-07T08:01:00Z'},{timestamp:'2026-10-06T07:59:00Z'},{timestamp:'invalid'}])assert.equal(groupChatMessages(first,{...next,...patch}),false);
 assert.equal(groupChatMessages(undefined,next),false);
});
test('explicit retry chains update one bubble with latest status and count; identical independent messages remain distinct',()=>{
 const root=message(10,{kind:'outbound',direction:'outbound',request_id:'original-0001',status:'failed',retryable:true});
 const again=message(11,{kind:'outbound',direction:'outbound',request_id:'retry-000001',retry_of:root.request_id,status:'failed',retryable:true,timestamp:'2026-10-06T08:01:00Z'});
 const sent=message(12,{kind:'outbound',direction:'outbound',request_id:'retry-000002',retry_of:again.request_id,status:'sent',retryable:false,timestamp:'2026-10-06T08:02:00Z'});
 const independent=message(13,{kind:'outbound',direction:'outbound',request_id:'independent1',status:'sent'});
 const raw=[root,again,sent,independent];const rows=visibleChatMessages(raw);
 assert.equal(rows.length,2);assert.equal(rows[0].id,12);assert.equal(rows[0].display_id,10);assert.equal(rows[0].status,'sent');assert.equal(rows[0].attempt_count,3);assert.equal(rows[0].timestamp,root.timestamp);assert.equal(rows[1].id,13);assert.equal(raw.length,4);
 assert.equal(visibleChatMessages([again,sent])[0].attempt_count,2);
 assert.equal(visibleChatMessages([sent,root,again])[0].id,12);
});
test('malformed or unrelated retry parents cannot hide a different message or loop forever',()=>{
 const first=message(1,{kind:'outbound',request_id:'one',retry_of:'two'}),second=message(2,{kind:'outbound',request_id:'two',retry_of:'one'});
 assert.equal(visibleChatMessages([first,second]).length,2);
 assert.equal(visibleChatMessages([first,{...second,body:'Different content',retry_of:'one'}]).length,2);
});
