import test from 'node:test';
import assert from 'node:assert/strict';
import {MessageFavorites,resolveFavorites,favoriteIdentity} from '../src/api/message-favorites.ts';
import {forwardedDraft,forwardTargets} from '../src/api/message-forward.ts';
import {InboxRepository} from '../src/api/repository.ts';
import {ApiError,type Message,type Conversation} from '../src/api/types.ts';
import type {Storage} from '../src/storage/interface.ts';
class Memory implements Storage {data=new Map<string,any>();async get<T>(key:string){return this.data.get(key)??null as T|null}async put(key:string,value:unknown){this.data.set(key,structuredClone(value))}async remove(key:string){this.data.delete(key)}async scan<T>(prefix:string):Promise<T[]>{return [...this.data].filter(([key])=>key.startsWith(prefix)).map(([,value])=>structuredClone(value))}async clear(){this.data.clear()}async close(){}}
const message={id:7,kind:'message',body:'A matéria: https://macro.markets/pt/blog/teste\nFoto: https://drive.google.com/file/d/example/view',timestamp:'2026-10-15T12:00:00Z'} as Message;
test('favorites persist as references, survive restart and stay isolated by account and conversation',async()=>{
 const disk=new Memory(),store=new MessageFavorites(disk);await store.toggle(1,message);assert.equal((await new MessageFavorites(disk).list(1)).length,1);assert.deepEqual(await store.list(2),[]);assert.deepEqual(await new MessageFavorites(new Memory()).list(1),[]);
 const record=(await store.list(1))[0];assert.ok(!JSON.stringify(record).includes(message.body));assert.deepEqual(resolveFavorites([record],[message]),[message]);await store.toggle(1,message);assert.deepEqual(await store.list(1),[]);
});
test('optimistic favorites follow confirmed message IDs, including note history without a request ID',async()=>{
 const disk=new Memory(),repo=new InboxRepository(disk,{request:async<T>()=>({} as T)});const local={...message,kind:'note',id:'local-test',request_id:'test'} as Message;
 await repo.saveMessages(1,[local]);await repo.toggleMessageFavorite(1,local);
 const confirmed={...local,id:19};await repo.saveMessages(1,[confirmed]);const history={...confirmed,request_id:undefined};await repo.saveMessages(1,[history]);
 assert.deepEqual(resolveFavorites(await repo.messageFavorites(1),[history]),[history]);assert.equal(await repo.toggleMessageFavorite(1,history),false);assert.deepEqual(await repo.messageFavorites(1),[]);
 assert.equal(favoriteIdentity({...local,kind:'outbound'}),favoriteIdentity({...confirmed,kind:'message',direction:'outbound'}));
});
test('rapid toggles serialize and revocation purges favorites without touching another conversation',async()=>{
 const disk=new Memory(),store=new MessageFavorites(disk);assert.deepEqual(await Promise.all([store.toggle(1,message),store.toggle(1,message)]),[true,false]);assert.deepEqual(await store.list(1),[]);
 const repo=new InboxRepository(disk,{request:async()=>{throw new ApiError(403,'forbidden','denied')}});await repo.saveMessages(1,[message]);await repo.toggleMessageFavorite(1,message);await repo.toggleMessageFavorite(2,message);await assert.rejects(repo.detail(1));assert.deepEqual(await repo.messageFavorites(1),[]);assert.equal((await repo.messageFavorites(2)).length,1);await repo.toggleMessageFavorite(1,message);assert.deepEqual(await disk.scan('favorite:1:'),[]);
});
test('forwarding preserves exact links, appends to existing drafts and never silently truncates',()=>{
 assert.equal(forwardedDraft('',message.body),message.body);assert.equal(forwardedDraft('Meu rascunho',message.body),'Meu rascunho\n\n'+message.body);assert.throws(()=>forwardedDraft('x'.repeat(3999),message.body),/forward_too_long/);assert.throws(()=>forwardedDraft('','  '),/forward_empty/);
 const base={id:2,kind:'inbox',contact_name:'Ana',asset:{name:'Carol Suporte',phone:'+5531975549190'},recipient:'123'} as Conversation;
 assert.deepEqual(forwardTargets([base,{...base,id:3,kind:'comments'},{...base,id:4,moderation:{spam:true}} as Conversation],1,'carol').map(c=>c.id),[2]);assert.deepEqual(forwardTargets([base],2,''),[]);
});
