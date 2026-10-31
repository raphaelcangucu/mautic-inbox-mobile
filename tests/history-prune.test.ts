import {test} from 'node:test';
import assert from 'node:assert/strict';
import {InboxRepository} from '../src/api/repository.ts';
import type {Message,Page} from '../src/api/types.ts';
import type {Storage} from '../src/storage/interface.ts';
class Memory implements Storage {
 data=new Map<string,any>();async get<T>(key:string){return this.data.get(key)??null as T|null}async put(key:string,value:any){this.data.set(key,structuredClone(value))}async remove(key:string){this.data.delete(key)}async scan<T>(prefix:string):Promise<T[]>{return [...this.data].filter(([k])=>k.startsWith(prefix)).map(([,v])=>structuredClone(v))}async clear(){this.data.clear()}async close(){}
}
const msg=(kind:string,id:number|string,minute:number)=>({kind,id,body:'x',timestamp:`2026-10-25T04:${String(minute).padStart(2,'0')}:00.000000+00:00`} as Message);
const keys=async(repo:InboxRepository)=>(await repo.cachedMessages(1)).map(m=>m.kind+':'+m.id);
function repoWith(page:Page<Message>){const disk=new Memory();return new InboxRepository(disk,{request:async<T>()=>structuredClone(page) as T})}

test('the newest history page drops a cached message the server hides in its range (ghost e-mail card)',async()=>{
 const repo=repoWith({items:[msg('outbound',10,20),msg('message',30,40)],next_cursor:'older'});
 // automatic:722 is the e-mail a poll cached while its request card was still pending; the server now folds it into outbound:10.
 await repo.saveMessages(1,[msg('message',5,10),msg('automatic',722,21),msg('outbound','local-req',30),msg('message',31,50)]);
 await repo.history(1);
 assert.deepEqual(await keys(repo),['message:5','outbound:10','outbound:local-req','message:30','message:31'],'Older than the page, still sending, or newer than the page: kept.');
});

test('without an older page the newest page is all of history, older cache included',async()=>{
 const repo=repoWith({items:[msg('outbound',10,20),msg('message',30,40)],next_cursor:null});
 await repo.saveMessages(1,[msg('message',5,10),msg('message',31,50)]);
 await repo.history(1);
 assert.deepEqual(await keys(repo),['outbound:10','message:30','message:31'],'Only what is newer than the page (a later poll) stays.');
});

test('older pages and empty pages never prune',async()=>{
 const older=repoWith({items:[msg('message',2,5)],next_cursor:null});
 await older.saveMessages(1,[msg('message',5,10)]);
 await older.history(1,'cursor');
 assert.deepEqual(await keys(older),['message:2','message:5']);
 const empty=repoWith({items:[],next_cursor:null});
 await empty.saveMessages(1,[msg('message',5,10)]);
 await empty.history(1);
 assert.deepEqual(await keys(empty),['message:5']);
});
