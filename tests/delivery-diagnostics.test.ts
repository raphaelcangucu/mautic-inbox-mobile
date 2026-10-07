import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deliveryReport,newDeliveryFailure} from '../src/api/delivery-diagnostics.ts';
import type {Message} from '../src/api/types.ts';
const message:Message={kind:'outbound',id:1,body:'PRIVATE CUSTOMER MESSAGE',status:'pending',timestamp:'2026-10-07T18:00:00Z',failure:'RAW RESPONSE MAY HAVE SECRET'};
test('shareable diagnostics include operational references and exclude customer content and raw failures',()=>{
 const report=deliveryReport(289,16,{...message,status:'failed',attempt_count:3,failure_code:'local_cooldown'});
 assert.match(report,/Conversation: 289/);assert.match(report,/Attempts: 3/);assert.match(report,/local_cooldown/);assert.ok(!report.includes(message.body));assert.ok(!report.includes(message.failure!));
});
test('delayed failures notify once; old failures and first history loads do not repeat alerts',()=>{
 const failed={...message,status:'failed' as const};assert.equal(newDeliveryFailure([message],[failed]),failed);assert.equal(newDeliveryFailure([failed],[failed]),undefined);assert.equal(newDeliveryFailure([],[failed]),undefined);
});
