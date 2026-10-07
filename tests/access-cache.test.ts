import {test} from 'node:test';
import assert from 'node:assert/strict';
import {InboxRepository} from '../src/api/repository.ts';
import {ApiError,type Conversation,type Message,type Outbox,type Transport,type ApiRequest} from '../src/api/types.ts';
import type {Storage} from '../src/storage/interface.ts';
class Memory implements Storage {
 data=new Map<string,any>();async get<T>(key:string){return this.data.get(key)??null as T|null}async put(key:string,value:any){this.data.set(key,structuredClone(value))}async remove(key:string){this.data.delete(key)}async scan<T>(prefix:string):Promise<T[]>{return [...this.data].filter(([k])=>k.startsWith(prefix)).map(([,v])=>structuredClone(v))}async clear(){this.data.clear()}async close(){}
}
const convo=(id:number)=>({id,can_reply:true,last_message_at:'2026-10-06T00:00:00Z'} as Conversation);
const message=(id:number)=>({id,kind:'message',body:'PRIVATE',timestamp:'2026-10-06T00:00:00Z'} as Message);
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(yes=>{resolve=yes});return {promise,resolve}}
async function seed(disk:Storage,id:number){await disk.put('conversation:'+id,convo(id));await disk.put('message:'+id+':message:1',message(1));await disk.put('draft:'+id+':reply','PRIVATE DRAFT');await disk.put('draft:'+id+':note','PRIVATE NOTE');await disk.put('cursor:'+id,'older');await disk.put('outbox:req'+id,{request_id:'req'+id,conversationId:id,body:'PRIVATE',status:'uncertain'} as Outbox)}
test('revoked transition purges only its account-local conversation, history, drafts and outbox',async()=>{
 const disk=new Memory();await seed(disk,1);await seed(disk,2);await disk.put('sync:list-ids',[1,2]);await disk.put('ui:view',{lastChat:1,chatOffsets:{1:10,2:20},chatAnchors:{1:'a',2:'b'}});let count=0;
 const repo=new InboxRepository(disk,{request:async<T>()=>({...convo(1),access_revoked:true} as T)},()=>count++);
 await assert.rejects(repo.transition(1,1,'transfer'),(e:any)=>e.code==='access_revoked');
 await repo.disk.get('ui:view');assert.equal(count,1);assert.equal(await repo.isRevoked(1),true);assert.equal(await repo.drafts(1,'reply'),'');assert.deepEqual(await repo.cachedMessages(1),[]);assert.equal(await disk.get('conversation:1'),null);assert.equal(await disk.get('outbox:req1'),null);assert.equal(await disk.get('cursor:1'),null);
 assert.equal(await repo.drafts(2,'reply'),'PRIVATE DRAFT');assert.equal((await repo.cachedMessages(2)).length,1);assert.deepEqual(await disk.get('sync:list-ids'),[2]);assert.deepEqual(await disk.get('ui:view'),{chatOffsets:{2:20},chatAnchors:{2:'b'}});
 const restart=new InboxRepository(disk,{request:async<T>()=>convo(1) as T});await restart.saveMessages(1,[message(99)]);assert.deepEqual(await restart.cachedMessages(1),[]);await restart.detail(1);assert.equal(await restart.isRevoked(1),false);await restart.saveMessages(1,[message(2)]);assert.equal((await restart.cachedMessages(1)).length,1);
});
test('late history and detail cannot resurrect data even after a later legitimate regrant',async()=>{
 const disk=new Memory();await seed(disk,1);const history=deferred<any>(),detail=deferred<any>();let late=true;
 const api:Transport={request:async<T>(r:ApiRequest)=>{if(r.path.endsWith('/history'))return history.promise;if(r.method==='POST')return {...convo(1),access_revoked:true} as T;return (late?detail.promise:Promise.resolve(convo(1))) as Promise<T>}};
 const repo=new InboxRepository(disk,api);const h=repo.history(1),d=repo.detail(1);await new Promise(resolve=>setImmediate(resolve));await assert.rejects(repo.transition(1,1,'transfer'));late=false;await repo.detail(1);history.resolve({items:[message(5)],next_cursor:null});detail.resolve(convo(1));await assert.rejects(h,(e:any)=>e.code==='access_revoked');await assert.rejects(d,(e:any)=>e.code==='access_revoked');assert.deepEqual(await repo.cachedMessages(1),[]);
});
test('denied reads purge, while denied editing, partial pagination and network errors preserve cached access',async()=>{
 for(const denied of [403,404]){const disk=new Memory();await seed(disk,1);const repo=new InboxRepository(disk,{request:async()=>{throw new ApiError(denied,'inbox_error','denied')}});await assert.rejects(repo.history(1));assert.deepEqual(await repo.cachedMessages(1),[])}
 for(const request of ['write','network','partial']){const disk=new Memory();await seed(disk,1);const repo=new InboxRepository(disk,{request:async<T>()=>{if(request==='partial')return {items:[],next_cursor:null,complete:false} as T;throw new ApiError(request==='write'?403:0,'forbidden','denied')}});if(request==='partial')await repo.list();else if(request==='write')await assert.rejects(repo.transition(1,1,'take'));else await assert.rejects(repo.history(1));assert.equal((await repo.cachedMessages(1)).length,1);assert.equal(await repo.drafts(1,'reply'),'PRIVATE DRAFT')}
});
test('only an exhaustive unfiltered list purges missing cached conversations',async()=>{
 const disk=new Memory();await seed(disk,1);await seed(disk,2);const repo=new InboxRepository(disk,{request:async<T>()=>({items:[convo(2)],next_cursor:null,complete:true} as T)});await repo.list();assert.equal(await repo.isRevoked(1),true);assert.deepEqual(await repo.cachedMessages(1),[]);assert.equal((await repo.cachedMessages(2)).length,1);assert.equal(await repo.drafts(2,'reply'),'PRIVATE DRAFT');
});

test('missing publication or denied AI feature does not revoke conversation viewing',async()=>{
 for(const [path,status] of [['publication',404],['ai',403]] as const){const disk=new Memory();await seed(disk,1);const repo=new InboxRepository(disk,{request:async()=>{throw new ApiError(status,'feature_unavailable','unavailable')}});await assert.rejects(repo.api.request({method:'GET',path:'/inbox/api/conversations/1/'+path}));assert.equal(await repo.isRevoked(1),false);assert.equal((await repo.cachedMessages(1)).length,1)}
});
test('restart completes an interrupted purge before exposing cached data',async()=>{
 const disk=new Memory();await seed(disk,1);await disk.put('access:revoked:1',{id:1});const repo=new InboxRepository(disk,{request:async<T>()=>({} as T)});assert.deepEqual(await repo.cachedMessages(1),[]);assert.equal(await repo.drafts(1,'note'),'');assert.equal(await disk.get('outbox:req1'),null);assert.equal(await disk.get('conversation:1'),null);
});
