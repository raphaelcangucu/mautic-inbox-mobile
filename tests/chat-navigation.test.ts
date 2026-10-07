import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ChatNavigation} from '../src/store/chat-navigation.ts';
import type {InboxRepository} from '../src/api/repository.ts';
import type {Conversation,Message} from '../src/api/types.ts';

function deferred<T>(){
  let resolve!:(value:T)=>void;let reject!:(error:Error)=>void;
  const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no});
  return {promise,resolve,reject};
}
const message=(id:number):Message=>({id,kind:'message',body:'Histórico '+id,timestamp:'2026-10-05T12:00:00Z'});
function repository(overrides:Record<string,unknown>={}){
  return {disk:{get:async()=>null},cachedMessages:async(id:number)=>[message(id)],drafts:async(id:number,mode:string)=>mode+' '+id,
    detail:async(id:number)=>({id} as Conversation),history:async()=>({items:[],next_cursor:null}),...overrides} as unknown as InboxRepository;
}
function load(overrides:Record<string,unknown>={}){
  const calls:string[]=[];
  return {calls,options:{valid:()=>true,flushDraft:async()=>{},offline:false,live:true,
    cached:(messages:Message[],draft:string)=>calls.push('cached:'+messages[0]?.id+':'+draft),
    detail:(c:Conversation)=>calls.push('detail:'+c.id),history:(messages:Message[])=>calls.push('history:'+messages[0]?.id),
    error:(error:unknown)=>calls.push('error:'+String(error)),...overrides}};
}

test('rapid A/B navigation ignores late A context and never queries its remaining history',async()=>{
  const navigation=new ChatNavigation();const a=deferred<Conversation>();const started=deferred<void>();const queries:number[]=[];
  const repo=repository({detail:(id:number)=>{if(id===1){started.resolve();return a.promise;}return Promise.resolve({id});},history:async(id:number)=>{queries.push(id);return {items:[],next_cursor:null};}});
  const first=load(),second=load();const openingA=navigation.open(1,repo,first.options);await started.promise;
  await navigation.open(2,repo,second.options);a.resolve({id:1} as Conversation);await openingA;
  assert.deepEqual(first.calls,['cached:1:reply 1']);assert.deepEqual(second.calls,['cached:2:reply 2','detail:2','history:2']);assert.deepEqual(queries,[2]);
});

test('out-of-order local cache reads cannot reopen the previous chat',async()=>{
  const navigation=new ChatNavigation();const delayed=deferred<Message[]>();const started=deferred<void>();
  const repo=repository({cachedMessages:(id:number)=>{if(id===1){started.resolve();return delayed.promise;}return Promise.resolve([message(id)]);}});
  const first=load({offline:true}),second=load({offline:true});const openingA=navigation.open(1,repo,first.options);await started.promise;
  await navigation.open(2,repo,second.options);delayed.resolve([message(1)]);await openingA;
  assert.deepEqual(first.calls,[]);assert.deepEqual(second.calls,['cached:2:reply 2']);
});

test('leaving chat or switching account suppresses stale errors and visible commits',async()=>{
  for(const leave of ['navigation','account']){
    const navigation=new ChatNavigation();const delayed=deferred<Conversation>();const started=deferred<void>();let valid=true;
    const repo=repository({detail:()=>{started.resolve();return delayed.promise;}});const current=load({valid:()=>valid});
    const opening=navigation.open(1,repo,current.options);await started.promise;
    if(leave==='navigation')navigation.invalidate();else valid=false;
    delayed.reject(new Error('Erro da conversa antiga'));await opening;
    assert.deepEqual(current.calls,['cached:1:reply 1']);
  }
});

test('offline reopening reuses memory without scanning message storage or making API requests',async()=>{
  const navigation=new ChatNavigation();let scans=0;let requests=0;
  const repo=repository({cachedMessages:async()=>{scans++;return [];},detail:async()=>{requests++;},history:async()=>{requests++;}});
  const current=load({offline:true,memory:[message(8)]});await navigation.open(8,repo,current.options);
  assert.equal(scans,0);assert.equal(requests,0);assert.deepEqual(current.calls,['cached:8:reply 8']);
});

test('reply/note selection is latest-wins and never replaces text typed during a draft read',async()=>{
  const navigation=new ChatNavigation();const note=deferred<string>();const started=deferred<void>();const applied:string[]=[];
  const repo=repository({drafts:(_id:number,mode:string)=>{if(mode==='note'){started.resolve();return note.promise;}return Promise.resolve('Resposta salva');}});
  const options={valid:()=>true,flushDraft:async()=>{},apply:(draft:string)=>applied.push(draft)};
  const choosingNote=navigation.changeMode(1,'note',repo,options);await started.promise;
  await navigation.changeMode(1,'reply',repo,options);note.resolve('Nota antiga');await choosingNote;
  assert.deepEqual(applied,['Resposta salva']);
  const other=deferred<string>();const began=deferred<void>();const typingRepo=repository({drafts:()=>{began.resolve();return other.promise;}});
  const loading=navigation.changeMode(1,'note',typingRepo,options);await began.promise;navigation.editedDraft();other.resolve('Rascunho atrasado');await loading;
  assert.deepEqual(applied,['Resposta salva']);
});

test('navigation during pending draft flush cancels mode restoration',async()=>{
  const navigation=new ChatNavigation();const flush=deferred<void>();let reads=0;let applied=false;
  const repo=repository({drafts:async()=>{reads++;return 'Outro chat';}});
  const choosing=navigation.changeMode(1,'note',repo,{valid:()=>true,flushDraft:()=>flush.promise,apply:()=>{applied=true;}});
  navigation.invalidate();flush.resolve();await choosing;assert.equal(reads,0);assert.equal(applied,false);
});


test('pending send is cancelled by navigation, draft edit, mode selection or account change',()=>{
 const navigation=new ChatNavigation();let account='A';
 const beforeNavigation=navigation.guard(()=>account==='A');navigation.invalidate();assert.equal(beforeNavigation(),false);
 const beforeTyping=navigation.guard(()=>account==='A');navigation.editedDraft();assert.equal(beforeTyping(),false);
 const beforeAccount=navigation.guard(()=>account==='A');account='B';assert.equal(beforeAccount(),false);
 const current=navigation.guard(()=>account==='B');assert.equal(current(),true);
});
