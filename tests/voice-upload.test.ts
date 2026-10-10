import test from 'node:test';import assert from 'node:assert/strict';
import {HttpTransport,conversationFromApi,messageFromApi} from '../src/api/http.ts';
import {checkedAudio,checkedAudioId} from '../src/voice/audio-upload.ts';
const account:any={origin:'https://mautic.example',config:{api_base:'https://mautic.example/inbox/mobile/api'}};
const session=async()=>({accessToken:'test-token',expiresAt:Date.now()+3600000});
const attachment={uri:'file:///private/account/voice.m4a',name:'Audio.m4a',mime:'audio/mp4',size:1024,duration:5000};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status});
test('audio upload stages private bytes and sends only an opaque scoped ID to reply',async()=>{
 const calls:{url:string;body:any}[]=[];let reads=0;
 const api=new HttpTransport(account,session,async()=>{},()=>{},(async(url:any,opts:any)=>{assert.equal(opts.headers.Authorization,'Bearer test-token');assert.equal(opts.redirect,'error');calls.push({url:String(url),body:JSON.parse(opts.body)});return String(url).endsWith('/audio')?response({audio_id:'a'.repeat(32)},201):response({status:'queued',item:{id:7,status:'queued',body:'Audio'},summary:{id:42}},202)}) as typeof fetch,async uri=>{reads++;assert.equal(uri,attachment.uri);return 'fixture-base64'});
 const request:any={method:'POST',path:'/inbox/api/conversations/42/reply',body:{request_id:'stable-audio-request-1234',body:'Audio',attachment}};
 const result:any=await api.request(request);assert.equal(result.item.status,'pending');assert.equal(calls.length,2);assert.equal(reads,1);assert.ok(calls[0].url.endsWith('/conversations/42/audio'));assert.equal(calls[0].body.request_id,calls[1].body.request_id);assert.equal(calls[1].body.audio_id,'a'.repeat(32));assert.equal(calls[1].body.attachment,undefined);assert.ok(!JSON.stringify(calls[1]).includes('file:///'));assert.equal(request.body.attachment,attachment);
});
test('failed upload does not attempt to queue a message; unsupported channels never read files',async()=>{
 let sends=0,reads=0;const api=new HttpTransport(account,session,async()=>{},()=>{},(async()=>{sends++;return response({code:'forbidden'},403)}) as typeof fetch,async()=>{reads++;return 'data'});
 await assert.rejects(api.request({method:'POST',path:'/inbox/api/conversations/42/reply',body:{request_id:'stable-audio-request-1234',attachment}}),(e:any)=>e.code==='forbidden');assert.equal(sends,1);assert.equal(reads,1);
 await assert.rejects(api.request({method:'POST',path:'/inbox/api/conversations/42/note',body:{attachment}}),(e:any)=>e.code==='unsupported_media');assert.equal(reads,1);
});
test('audio boundaries reject non-finite values, remote files, excess duration and malformed IDs',()=>{
 for(const bad of [{size:NaN},{duration:NaN},{size:Infinity},{duration:181001},{size:2097153},{uri:'https://outside.example/audio'},{mime:'video/mp4'}])assert.throws(()=>checkedAudio({...attachment,...bad}));assert.deepEqual(checkedAudio(attachment),attachment);assert.throws(()=>checkedAudioId({audio_id:'../../secrets'}));assert.equal(checkedAudioId({audio_id:'b'.repeat(32)}),'b'.repeat(32));
});
test('audio authentication stays on the exact owned route and server capability fails closed',async()=>{
 const api=new HttpTransport(account,session,async()=>{},()=>{});const id='a'.repeat(32);
 assert.equal((await api.mediaSource('/inbox/mobile/api/audio/'+id)).headers?.Authorization,'Bearer test-token');
 for(const uri of ['https://outside.example/inbox/mobile/api/audio/'+id,'/inbox/mobile/api/audio/'+id+'/other','/public/audio/'+id])assert.equal((await api.mediaSource(uri)).headers,undefined);
 assert.equal(conversationFromApi({id:1}).mobile.attachments,false);assert.equal(conversationFromApi({id:1,mobile:{attachments:true}}).mobile.attachments,true);
 assert.equal(messageFromApi({attachments:[{type:'audio',mime:'audio/mp4',url:'/inbox/mobile/api/audio/'+id}]}).attachment?.mime,'audio/mp4');
});

test('server retries keep the same message pending rather than an undefined delivery status',()=>{for(const status of ['queued','waiting','retry']){const message=messageFromApi({id:113,kind:'outbound',status});assert.equal(message.id,113);assert.equal(message.status,'pending')}});
