import test from 'node:test';
import assert from 'node:assert/strict';
import {QrRequestLane} from '../src/api/qr-request-lane.ts';
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve}}
test('slow status read cannot drop a user start action or cause concurrent requests',async()=>{
 const lane=new QrRequestLane(),read=deferred(),action=deferred();const events:string[]=[];
 const polling=lane.poll(async()=>{events.push('read');await read.promise;events.push('read done');return 'ready'});
 await Promise.resolve();
 const starting=lane.action(async()=>{events.push('start');await action.promise;events.push('start done');return 'waiting'});
 assert.equal(await lane.poll(async()=>{events.push('unexpected read');return 'ready'}),undefined);
 assert.deepEqual(events,['read']);read.resolve();assert.equal(await polling,'ready');
 await Promise.resolve();await Promise.resolve();assert.deepEqual(events,['read','read done','start']);
 assert.equal(await lane.poll(async()=>{throw Error('must not poll during start')}),undefined);
 action.resolve();assert.equal(await starting,'waiting');assert.equal(await lane.poll(async()=>'waiting'),'waiting');
});
test('failed status read permits the queued action and failed action permits later refresh',async()=>{
 const lane=new QrRequestLane(),read=deferred();
 const polling=lane.poll(async()=>{await read.promise;throw Error('status unavailable')});
 const starting=lane.action(async()=>'waiting');read.resolve();await assert.rejects(polling,/status unavailable/);assert.equal(await starting,'waiting');
 await assert.rejects(lane.action(async()=>{throw Error('start rejected')}),/start rejected/);
 assert.equal(await lane.poll(async()=>'ready'),'ready');
});
test('a second user action cannot issue a duplicate mutation',async()=>{
 const lane=new QrRequestLane(),action=deferred();let mutations=0;
 const first=lane.action(async()=>{mutations++;await action.promise});
 await assert.rejects(lane.action(async()=>{mutations++}),/Aguarde/);assert.equal(mutations,1);action.resolve();await first;
});
