import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadCataloguePage} from '../src/components/crm-catalogue.ts';
import {featureRequest,type Remote} from '../src/api/features.ts';
import type {Account,ApiRequest,Transport} from '../src/api/types.ts';
const account={user:{id:8}} as Account;
function context(){
 const data:Remote={sequence:1,conversations:[],messages:{},catalogue:{campaign:Array.from({length:1000},(_,i)=>({id:i+1,name:'Campanha '+String(i+1).padStart(4,'0')})),segment:Array.from({length:1000},(_,i)=>({id:i+1,name:'Segmento '+String(i+1).padStart(4,'0')}))}};
 const requests:ApiRequest[]=[];const cache=new Map<string,any>();
 const api:Transport={async request<T>(r:ApiRequest):Promise<T>{requests.push(r);return featureRequest(data,account,r) as T}};
 const disk={async get<T>(key:string):Promise<T|null>{return cache.get(key)||null},async put(key:string,value:any){cache.set(key,value)}};
 return {repo:{api,disk},requests};
}
test('1000 campaigns and segments remain bounded and the last item can be found without fetching the entire catalogue',async()=>{
 const {repo,requests}=context();const first=await loadCataloguePage(repo,'campaign','',null,false);assert.equal(first.items.length,20);assert.equal(first.next_cursor,'20');
 const next=await loadCataloguePage(repo,'campaign','',first.next_cursor,false);assert.equal(next.items[0].id,21);assert.equal(next.items.length,20);
 const last=await loadCataloguePage(repo,'campaign','1000',null,false);assert.deepEqual(last.items,[{id:1000,name:'Campanha 1000'}]);assert.equal(last.next_cursor,null);
 const segment=await loadCataloguePage(repo,'segment','1000',null,false);assert.deepEqual(segment.items,[{id:1000,name:'Segmento 1000'}]);
 const saved=await loadCataloguePage(repo,'campaign','1000',null,true);assert.deepEqual(saved,last);assert.equal(requests.length,4);
 await assert.rejects(loadCataloguePage(repo,'segment','missing',null,true),/ainda não está salva/);
 assert.ok(requests.every(r=>r.query?.limit===20&&r.method==='GET'));assert.equal(requests[1].query?.cursor,'20');
});
test('empty matches, literal wildcard searches and invalid oversized API responses cannot inflate the autocomplete',async()=>{
 const {repo}=context();const absent=await loadCataloguePage(repo,'campaign','inexistente',null,false);assert.deepEqual(absent,{items:[],next_cursor:null});
 assert.deepEqual((await loadCataloguePage(repo,'campaign','%',null,false)).items,[]);
 const bad:Transport={async request<T>():Promise<T>{return {items:Array.from({length:1000},(_,i)=>({id:i+1,name:'Item'})),next_cursor:null} as T}};
 await assert.rejects(loadCataloguePage({...repo,api:bad},'campaign','',null,false),/resposta inválida/);
});
