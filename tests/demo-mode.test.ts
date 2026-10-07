import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {create} from 'zustand';
import {accountStorageId,bootAccount,visibleAccounts} from '../src/store/demo-mode.ts';
import {ShakeDetector} from '../src/hooks/shake-detector.ts';
import {newDeliveryFailure} from '../src/api/delivery-diagnostics.ts';
import {HttpTransport} from '../src/api/http.ts';
import {MockTransport} from '../src/api/mock.ts';
import {InboxRepository} from '../src/api/repository.ts';
import {demoAccounts,seed} from '../src/api/fixtures.ts';
import {ChatNavigation} from '../src/store/chat-navigation.ts';
import {defaultView,type Account,type Session} from '../src/api/types.ts';
import type {Storage} from '../src/storage/interface.ts';

class Memory implements Storage{
 data=new Map<string,unknown>();async get<T>(k:string){return (this.data.get(k)??null) as T|null}
 async put(k:string,v:unknown){this.data.set(k,structuredClone(v))}async remove(k:string){this.data.delete(k)}
 async scan<T>(p:string){return [...this.data].filter(([k])=>k.startsWith(p)).map(([,v])=>structuredClone(v) as T)}
 async clear(){this.data.clear()}async close(){}
}
const live:Account={id:'real-user',name:'Actual Mautic',origin:'https://mautic.example',mode:'live',user:{id:8,name:'Real Operator',email:'real@example.test'},config:{version:1,name:'Actual Mautic',origin:'https://mautic.example',api_base:'https://mautic.example/inbox/mobile/api',authorization_endpoint:'https://mautic.example/authorize',token_endpoint:'https://mautic.example/token',redirect_uri:'mautic-inbox-demo://oauth/callback',capabilities:{}}};
const mock:Account={...demoAccounts[0],mode:'mock'};
function harness(accounts:Account[]=[],activeId:string|null=null){
 let metadata:string|null=accounts.length?JSON.stringify({accounts,activeId,theme:'light'}):null;
 const disks=new Map<string,Memory>();const sessions=new Map<string,Session>();let fixturesCreated=0;
 const disk=(id:string)=>{if(!disks.has(id))disks.set(id,new Memory());return disks.get(id)!};
 class CountedMock extends MockTransport{constructor(a:Account,d:Storage){super(a,d);fixturesCreated++}}
 class FailedHttp extends HttpTransport{constructor(a:Account,read:()=>Promise<Session|null>,write:(s:Session)=>Promise<void>,expired:()=>void){super(a,read,write,expired,(async()=>Response.json({error:'unavailable'},{status:503})) as typeof fetch)}}
 const exports:any={};
 const source=ts.transpileModule(fs.readFileSync(new URL('../src/store/app.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const modules:any={
 '../i18n/engine.ts':{t:(key:string)=>key},'zustand':{create},'react-native':{Platform:{OS:'web'}},
 '../api/delivery-diagnostics':{newDeliveryFailure},'../api/reply-mode':{initialReplyMode:()=> 'public'},'../api/push-accounts':{},'../api/notification-policy':{},'../api/native-push':{},
 '../api/http':{HttpTransport:FailedHttp},'@react-native-async-storage/async-storage':{getItem:async()=>metadata,setItem:async(_:string,value:string)=>{metadata=value}},
 'expo-crypto':{},'expo-notifications':{},'../storage/disk':{openDisk:async(id:string)=>disk(id),deleteAccountDisk:async()=>{}},
 '../storage/vault':{readSession:async(id:string)=>sessions.get(id)||null,saveSession:async(id:string,s:Session)=>{sessions.set(id,s)},deleteSession:async(id:string)=>{sessions.delete(id)}},
 '../api/repository':{InboxRepository},'./chat-navigation':{ChatNavigation},'../api/mock':{MockTransport:CountedMock},'../api/fixtures':{demoAccounts},
 '../api/types':{defaultView},'./demo-mode':{accountStorageId,bootAccount}
 };
 vm.runInNewContext(source,{exports,require:(name:string)=>{assert.ok(name in modules,name);return modules[name]},Date,URL,setTimeout,clearTimeout,performance,console});
 return {app:exports.useApp,disk,sessions,created:()=>fixturesCreated,metadata:()=>JSON.parse(metadata!)};
}
async function idle(app:any){for(let n=0;n<300&&app.getState().syncing;n++)await new Promise(r=>setTimeout(r,2));assert.equal(app.getState().syncing,false)}

test('fresh installation and saved demo-only installation never enable mocks on startup',async()=>{
 for(const h of [harness(),harness([mock],mock.id)]){await h.app.getState().boot();assert.equal(h.app.getState().active,null);assert.equal(h.app.getState().demoUnlocked,false);assert.equal(h.app.getState().route,'accounts');assert.equal(h.created(),0);assert.equal(visibleAccounts(h.app.getState().accounts,false).length,0)}
});
test('a remembered demo cannot override the real account on startup',async()=>{
 const h=harness([mock,live],mock.id);h.sessions.set(live.id,{accessToken:'real',expiresAt:Date.now()+3600000});
 await h.app.getState().boot();await idle(h.app);assert.equal(h.app.getState().active.id,live.id);assert.equal(h.created(),0);
});
test('API failure keeps the real cached history and never seeds a mock transport',async()=>{
 const h=harness([live,mock],live.id);h.sessions.set(live.id,{accessToken:'real',expiresAt:Date.now()+3600000});
 const c={...seed(mock).conversations[0],id:999,contact_name:'Real cached contact'};await h.disk(live.id).put('conversation:999',c);
 await h.app.getState().boot();await idle(h.app);
 assert.equal(h.app.getState().active.mode,'live');assert.equal(h.app.getState().conversations[0].contact_name,'Real cached contact');assert.match(h.app.getState().error,/503/);assert.equal(h.created(),0);
 h.app.getState().navigate('diagnostics');assert.equal(h.app.getState().route,'inbox');
 await h.app.getState().switchAccount(mock);assert.equal(h.app.getState().active.id,live.id);assert.equal(h.created(),0);
});
test('explicit test-mode unlock does not switch the real account; mock selection has isolated storage',async()=>{
 const h=harness([live],live.id);h.sessions.set(live.id,{accessToken:'real',expiresAt:Date.now()+3600000});
 await h.app.getState().boot();await idle(h.app);await h.app.getState().unlockDemo();
 assert.equal(h.app.getState().active.id,live.id);assert.equal(h.created(),0);assert.equal(h.sessions.get(live.id)?.accessToken,'real');
 await h.app.getState().switchAccount(h.app.getState().accounts.find((a:Account)=>a.mode==='mock'));await idle(h.app);
 assert.equal(h.created(),1);assert.ok(h.disk('mock:'+mock.id).data.has('mock:remote'));assert.equal(h.disk(live.id).data.has('mock:remote'),false);
 await h.app.getState().hideDemo();assert.equal(h.app.getState().active,null);assert.equal(h.app.getState().demoUnlocked,false);assert.ok(h.app.getState().accounts.some((a:Account)=>a.id===live.id));
 assert.equal(h.metadata().demoUnlocked,undefined);assert.equal(h.sessions.get(live.id)?.accessToken,'real');
});
test('fixture and real caches remain distinct even for an identical account id',()=>{
 assert.notEqual(accountStorageId(live),accountStorageId({...live,mode:'mock'}));
});
test('shake ignores ordinary motion and requires alternating impulses with cooldown',()=>{
 const shake=new ShakeDetector();for(let n=0;n<10;n++)assert.equal(shake.sample({x:n*.1,y:0,z:1},n*100),false);
 assert.equal(shake.sample({x:3,y:0,z:1},1200),false);assert.equal(shake.sample({x:-3,y:0,z:1},1300),false);assert.equal(shake.sample({x:3,y:0,z:1},1400),true);
 for(let n=0;n<8;n++)assert.equal(shake.sample({x:n%2?3:-3,y:0,z:1},1500+n*100),false);
});
test('isolated movement and repeating impulses do not unlock test mode',()=>{
 const shake=new ShakeDetector();assert.equal(shake.sample({x:0,y:0,z:1},0),false);
 for(const [n,x] of [[100,3],[1000,-3],[2000,3],[2100,6],[2200,9]])assert.equal(shake.sample({x,y:0,z:1},n),false);
});
