import {test} from 'node:test';
import assert from 'node:assert/strict';
import {InboxRepository} from '../src/api/repository.ts';
import {canRetryMessage} from '../src/api/message-retry.ts';
import {ApiError,type Message,type Outbox,type ApiRequest} from '../src/api/types.ts';
import type {Storage} from '../src/storage/interface.ts';
class Memory implements Storage {
 data=new Map<string,string>();async get<T>(key:string):Promise<T|null>{const value=this.data.get(key);return value?JSON.parse(value):null}async put(key:string,value:unknown){this.data.set(key,JSON.stringify(value))}async remove(key:string){this.data.delete(key)}async scan<T>(prefix:string):Promise<T[]>{return [...this.data].filter(([key])=>key.startsWith(prefix)).map(([,value])=>JSON.parse(value))}async clear(){this.data.clear()}async close(){}
}
const failed:Message={kind:'outbound',id:91,body:'Controlled retry',request_id:'original-request-001',timestamp:'2026-10-07T18:00:00Z',status:'failed',retryable:true};
const attempt='retry-request-00001';
const page=(items:Message[],next_cursor:string|null=null)=>({items,next_cursor});
test('only failed server outbounds or saved local failures offer retry; incoming, notes and nonretryable failures do not',()=>{
 assert.equal(canRetryMessage(failed),true);
 for(const change of [{retryable:false},{status:'sent'},{kind:'message'},{kind:'note'},{status:'pending'}])assert.equal(canRetryMessage({...failed,...change} as Message),false);
 assert.equal(canRetryMessage({...failed,id:'local-original-request-001',status:'uncertain',retryable:undefined}),true);
});
test('remote failure reuses the web retry operation, double taps and later taps do not create duplicate attempts',async()=>{
 const disk=new Memory();let posts=0;let registered:Message|undefined;
 const repo=new InboxRepository(disk,{request:async<T>(r:ApiRequest)=>{
  if(r.method==='GET')return page(registered?[registered,failed]:[failed]) as T;
  assert.equal(r.path,'/inbox/api/outbound/91/retry');assert.deepEqual(r.body,{request_id:attempt});posts++;
  registered={...failed,id:92,request_id:attempt,status:'pending',retryable:false};return {item:registered} as T;
 }});
 const result=await Promise.all([repo.retryMessage(289,failed,attempt),repo.retryMessage(289,failed,'other-retry-000001')]);
 assert.deepEqual(result,['registered','registered']);assert.equal(posts,1);
 assert.equal(await repo.retryMessage(289,failed,'yet-another-000001'),'already_registered');assert.equal(posts,1);
 assert.equal((await repo.cachedMessages(289)).filter(m=>m.id===92).length,1);
});
test('fresh sent receipts replace stale failed UI without sending',async()=>{
 const disk=new Memory();const calls:ApiRequest[]=[];const repo=new InboxRepository(disk,{request:async<T>(r:ApiRequest)=>{calls.push(r);return page([{...failed,status:'delivered',retryable:false}]) as T}});
 assert.equal(await repo.retryMessage(289,failed,attempt),'already_registered');assert.equal(calls.length,1);assert.equal((await repo.cachedMessages(289))[0].status,'delivered');
});
test('a retry registered on another device supersedes the old failed bubble without another send, across pages',async()=>{
 for(const status of ['sent','pending','failed'] as const){
  const child={...failed,id:92,request_id:'other-device-retry-001',retry_of:failed.request_id,status};
  let gets=0;
  const repo=new InboxRepository(new Memory(),{request:async<T>(r:ApiRequest)=>{
   assert.equal(r.method,'GET');gets++;
   return (r.query?.before?page([failed]):page([child],'older')) as T;
  }});
  assert.equal(await repo.retryMessage(289,failed,attempt),'already_registered');assert.equal(gets,2);
  assert.equal((await repo.cachedMessages(289)).find(m=>m.id===92)?.status,status);
 }
});
test('server reconciliation of a simultaneous retry keeps the existing child receipt',async()=>{
 const child={...failed,id:92,request_id:'other-device-retry-001',retry_of:failed.request_id,status:'sent' as const};
 const disk=new Memory();const repo=new InboxRepository(disk,{request:async<T>(r:ApiRequest)=>(r.method==='GET'?page([failed]):{item:child}) as T});
 assert.equal(await repo.retryMessage(289,failed,attempt),'already_registered');
 assert.equal((await repo.cachedMessages(289)).find(m=>m.id===92)?.request_id,child.request_id);
 const unsafe=new InboxRepository(new Memory(),{request:async<T>(r:ApiRequest)=>(r.method==='GET'?page([failed]):{item:{...child,body:'Unrelated message'}}) as T});
 await assert.rejects(unsafe.retryMessage(289,failed,attempt),(e:any)=>e.code==='invalid_retry_response');
});
test('uncertain retry after restart keeps its stable request ID even if the response was lost',async()=>{
 const disk=new Memory();const ids:string[]=[];let first=true;
 const api={request:async<T>(r:ApiRequest)=>{if(r.method==='GET')return page([failed]) as T;ids.push(String((r.body as any).request_id));if(first){first=false;throw new ApiError(0,'network_error','lost response')}return {item:{...failed,id:92,request_id:attempt,status:'pending'}} as T}};
 await assert.rejects(new InboxRepository(disk,api).retryMessage(289,failed,attempt));
 await new InboxRepository(disk,api).retryMessage(289,failed,'replacement-00001');assert.deepEqual(ids,[attempt,attempt]);
});
test('uncertain local send reconciles a receipt or resubmits only with the original identifier and payload',async()=>{
 const disk=new Memory();const entry:Outbox={request_id:failed.request_id!,conversationId:289,body:failed.body,mode:'reply',timestamp:failed.timestamp,status:'uncertain',replyMode:'private'};
 const local={...failed,id:'local-'+entry.request_id,status:'uncertain' as const};await disk.put('outbox:'+entry.request_id,entry);await disk.put('message:289:outbound:'+local.id,local);
 const requests:ApiRequest[]=[];const repo=new InboxRepository(disk,{request:async<T>(r:ApiRequest)=>{requests.push(r);return (r.method==='GET'?page([]):{item:{...failed,status:'sent'}}) as T}});
 await repo.retryMessage(289,local,attempt);assert.equal(requests[1].path,'/inbox/api/conversations/289/reply');assert.equal((requests[1].body as any).request_id,entry.request_id);assert.equal((requests[1].body as any).reply_mode,'private');assert.equal(await disk.get('outbox:'+entry.request_id),null);
 await disk.put('outbox:'+entry.request_id,entry);await disk.put('message:289:outbound:'+local.id,local);
 const reconcile=new InboxRepository(disk,{request:async<T>(r:ApiRequest)=>{assert.equal(r.method,'GET');return page([{...failed,status:'pending'}]) as T}});
 assert.equal(await reconcile.retryMessage(289,local,attempt),'already_registered');assert.equal(await disk.get('outbox:'+entry.request_id),null);
});
test('pagination finds old failures, failed or looping history never authorizes a send',async()=>{
 const disk=new Memory();let gets=0,posts=0;
 const repo=new InboxRepository(disk,{request:async<T>(r:ApiRequest)=>{if(r.method==='POST'){posts++;return {item:{...failed,id:92,request_id:attempt,status:'pending'}} as T}gets++;return (r.query?.before?page([failed]):page([{...failed,id:99,request_id:'different-request'}],'older')) as T}});
 await repo.retryMessage(289,failed,attempt);assert.equal(gets,2);assert.equal(posts,1);
 for(const error of [new ApiError(0,'offline','Offline'),new ApiError(403,'forbidden','No access')]){
  const blocked=new InboxRepository(new Memory(),{request:async<T>(r:ApiRequest)=>{assert.equal(r.method,'GET');throw error}});await assert.rejects(blocked.retryMessage(289,failed,attempt));
 }
 const loop=new InboxRepository(new Memory(),{request:async<T>(r:ApiRequest)=>{assert.equal(r.method,'GET');return page([],'loop') as T}});await assert.rejects(loop.retryMessage(289,failed,attempt),(e:any)=>e.code==='history_incomplete');
});
test('server denies a retry without dropping the original failed message or its stable retry ID',async()=>{
 const disk=new Memory();const repo=new InboxRepository(disk,{request:async<T>(r:ApiRequest)=>{if(r.method==='GET')return page([failed]) as T;throw new ApiError(409,'assigned','Take the conversation')}});
 await assert.rejects(repo.retryMessage(289,failed,attempt));assert.equal((await repo.cachedMessages(289))[0].status,'failed');assert.equal((await disk.get<any>('retry:289:outbound:91')).request_id,attempt);
});
test('local uncertainty that resolves to a remote failure stores the retry under its server source identity',async()=>{
 const disk=new Memory();const local={...failed,id:'local-'+failed.request_id,status:'uncertain' as const};
 await disk.put('outbox:'+failed.request_id,{request_id:failed.request_id,conversationId:289,body:failed.body,mode:'reply',timestamp:failed.timestamp,status:'uncertain'});
 const ids:string[]=[];let first=true;
 const api={request:async<T>(r:ApiRequest)=>{if(r.method==='GET')return page([failed]) as T;ids.push(String((r.body as any).request_id));if(first){first=false;throw new ApiError(0,'network_error','Lost response')}return {item:{...failed,id:92,request_id:attempt,status:'pending'}} as T}};
 await assert.rejects(new InboxRepository(disk,api).retryMessage(289,local,attempt));
 assert.equal((await disk.get<any>('retry:289:outbound:91')).request_id,attempt);
 await new InboxRepository(disk,api).retryMessage(289,failed,'different-id-00001');assert.deepEqual(ids,[attempt,attempt]);
});
