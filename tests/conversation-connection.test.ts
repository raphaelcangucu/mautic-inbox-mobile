import {test} from 'node:test';
import assert from 'node:assert/strict';
import {conversationConnection,conversationSearch} from '../src/api/conversation-connection.ts';
import {conversationFromApi} from '../src/api/http.ts';
import {InboxRepository} from '../src/api/repository.ts';
import type {Conversation,Message,Transport,ApiRequest} from '../src/api/types.ts';
import type {Storage} from '../src/storage/interface.ts';
class Memory implements Storage {
 data=new Map<string,unknown>();async get<T>(k:string){return this.data.has(k)?structuredClone(this.data.get(k)) as T:null}async put(k:string,v:unknown){this.data.set(k,structuredClone(v))}async remove(k:string){this.data.delete(k)}async scan<T>(p:string){return [...this.data].filter(([k])=>k.startsWith(p)).map(([,v])=>structuredClone(v) as T)}async clear(){this.data.clear()}async close(){}
}
const make=(id:number,asset:number,phone:string)=>conversationFromApi({id,conversation_id:id+100,version:1,assignee:null,channel:'whatsapp',contact_name:'Same person',contact:{id:4,name:'Same person'},recipient:'5511999999999',asset:{id:asset,name:'Support',phone,type:'whatsapp_qr_session'},last_message_at:'2026-10-07T12:00:00Z'});
test('sending connection label uses the asset phone even when two names and the recipient are identical',()=>{
 const a=make(1,16,'+553111111111'),b=make(2,19,'+553122222222');
 assert.equal(conversationConnection(a).label,'Support · +553111111111');assert.equal(conversationConnection(b).label,'Support · +553122222222');
 assert.ok(!conversationConnection(a).label.includes(a.recipient));
 assert.equal(conversationSearch(a,'(31) 1111-1111'),true);assert.equal(conversationSearch(b,'(31) 1111-1111'),false);
 assert.equal(conversationSearch(a,'support'),true);assert.equal(conversationSearch({...a,contact_name:'Profile name'},'Same person'),true);
});
test('missing sending number never falls back to the customer phone',()=>{
 const c=make(1,16,'');c.contact!.phone='+5511999999999';assert.equal(conversationConnection(c).label,'Support');
 c.asset.name='';assert.equal(conversationConnection(c).label,'WhatsApp #16');
 c.channel='facebook';c.asset.phone='+553111111111';assert.equal(conversationConnection(c).phone,'');
});
test('same contact on two WhatsApps keeps separate entries, drafts, histories and reply routing after restart',async()=>{
 const disk=new Memory();const a=make(1,16,'+553111111111'),b=make(2,19,'+553122222222');const paths:string[]=[];
 const api:Transport={request:async<T>(r:ApiRequest)=>{paths.push(r.path);if(r.path==='/inbox/api/conversations')return {items:[a,b],next_cursor:null,complete:true} as T;if(r.path.endsWith('/reply'))return {item:{id:9,kind:'outbound',body:r.body!.body,timestamp:'2026-10-07T12:03:00Z',status:'pending'}} as T;throw Error('Unexpected request')}};
 const first=new InboxRepository(disk,api);assert.equal((await first.list()).length,2);
 const msg=(body:string):Message=>({id:1,kind:'message',body,timestamp:'2026-10-07T12:00:00Z'});
 await first.saveMessages(a.id,[msg('Only A')]);await first.saveMessages(b.id,[msg('Only B')]);await disk.put('draft:1:reply','Draft A');await disk.put('draft:2:reply','Draft B');
 const reopened=new InboxRepository(disk,api);assert.equal((await reopened.cachedList()).length,2);assert.equal((await reopened.cachedMessages(1))[0].body,'Only A');assert.equal((await reopened.cachedMessages(2))[0].body,'Only B');assert.equal(await reopened.drafts(1,'reply'),'Draft A');assert.equal(await reopened.drafts(2,'reply'),'Draft B');
 await reopened.send({request_id:'connection-b-only',conversationId:2,body:'Reply through B',mode:'reply',timestamp:'2026-10-07T12:03:00Z',status:'sending'});
 assert.equal(paths.at(-1),'/inbox/api/conversations/2/reply');assert.equal((await reopened.cachedMessages(1)).length,1);assert.equal((await reopened.cachedMessages(2)).length,2);
 await reopened.saveConversations([{...b,unread:5,assignee:{id:20,name:'Operator B'}}]);assert.equal((await reopened.cachedList()).find(c=>c.id===1)!.assignee,null);
});
