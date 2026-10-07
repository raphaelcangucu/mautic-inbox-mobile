import test from 'node:test';
import assert from 'node:assert/strict';
import {syncPushAccounts} from '../src/api/push-accounts.ts';

test('an unavailable inactive Mautic does not prevent push registration in other instances',async()=>{
 const registered:string[]=[];const failed:string[]=[];
 await syncPushAccounts([{id:'offline'},{id:'active'},{id:'other'}],async a=>{
  if(a.id==='offline')throw new Error('Mautic unavailable');registered.push(a.id);
 },()=> 'active',a=>failed.push(a.id));
 assert.deepEqual(registered,['active','other']);assert.deepEqual(failed,['offline']);
});

test('active Mautic error remains visible after the remaining registrations finish',async()=>{
 const failure=new Error('APNs registration failed');const registered:string[]=[];
 await assert.rejects(syncPushAccounts([{id:'active'},{id:'other'}],async a=>{
  if(a.id==='active')throw failure;registered.push(a.id);
 },()=> 'active',()=>{}),error=>error===failure);
 assert.deepEqual(registered,['other']);
});

test('switching accounts while registering does not surface the old account error in the new one',async()=>{
 let active='previous';const registered:string[]=[];
 await syncPushAccounts([{id:'previous'},{id:'current'}],async a=>{
  if(a.id==='previous'){active='current';throw new Error('Previous account unavailable')}
  registered.push(a.id);
 },()=>active,()=>{});
 assert.deepEqual(registered,['current']);
});
