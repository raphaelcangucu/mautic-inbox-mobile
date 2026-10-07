import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectQrConnection,qrConversation,qrNeedsRecovery,type QrPairing} from '../src/api/whatsqr.ts';
import {ApiError,type Conversation,type Transport} from '../src/api/types.ts';
const status=(stage:QrPairing['stage'],cause:string|null=null):QrPairing=>({id:19,name:'Support',stage,cause,can_start:false,can_regenerate:cause==='unpaired',image_base64:null,image_mime:'image/png',version:'current',refresh_after:5});
test('recovery targets only a WhatsQR conversation, never official WhatsApp or another channel',()=>{
 const c={channel:'whatsapp',asset:{id:19,type:'whatsapp_qr_session'}} as Conversation;
 assert.equal(qrConversation(c),true);
 assert.equal(qrConversation({...c,asset:{...c.asset,type:'whatsapp_phone_number'}}),false);
 assert.equal(qrConversation({...c,channel:'instagram'}),false);
 assert.equal(qrConversation({...c,asset:{id:19,name:'WhatsApp QR'}}),false);
});
test('transient drops, lost pairing and service outages open diagnosis without any reset or resend',async()=>{
 for(const value of [status('connected'),status('reconnecting'),status('not_done','unpaired'),status('not_done','service_down'),status('not_done','refused')]){
  const calls:any[]=[];const api:Transport={request:async<T>(input:any)=>{calls.push(input);return value as T}};
  const result=await inspectQrConnection(api,19);assert.ok(result);assert.equal(qrNeedsRecovery(result),value.stage!=='connected');
  assert.deepEqual(calls,[{method:'GET',path:'/inbox/mobile/whatsqr/19'}]);
  assert.equal(result.can_regenerate,value.cause==='unpaired');
 }
});
test('API login, phone network errors and a different asset do not trigger pairing',async()=>{
 for(const failure of [new ApiError(401,'unauthorized','expired'),new ApiError(403,'forbidden','denied'),new ApiError(0,'network_error','offline')]){
  const api:Transport={request:async()=>{throw failure}};assert.equal(await inspectQrConnection(api,19),null);
 }
 const api:Transport={request:async<T>()=>({...status('not_done','unpaired'),id:16}) as T};assert.equal(await inspectQrConnection(api,19),null);
});
