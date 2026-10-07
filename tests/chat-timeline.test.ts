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
