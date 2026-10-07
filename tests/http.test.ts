import test from 'node:test';
import assert from 'node:assert/strict';
import {HttpTransport,conversationFromApi,checkedOrigin,discover,apiFailure} from '../src/api/http.ts';
import {ApiError,type Account,type Session} from '../src/api/types.ts';
const account:Account={id:'test-live',origin:'https://mautic.example',name:'Test',mode:'live',user:{id:7,name:'Operator',email:'operator@example.test'},config:{version:1,name:'Test',origin:'https://mautic.example',api_base:'https://mautic.example/inbox/mobile/api',token_endpoint:'https://mautic.example/inbox/mobile/token',authorization_endpoint:'https://mautic.example/s/inbox/mobile/authorize',redirect_uri:'mautic-inbox-demo://oauth/callback',capabilities:{}}};
const session=():Session=>({accessToken:'opaque-access',refreshToken:'opaque-refresh',expiresAt:Date.now()+3600000});
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const raw=(id:number)=>({id,conversation_id:id+100,version:1,channel:'instagram',recipient:'participant-id',contact_name:'Real contact',asset:{id:9,name:'Actual asset'},last_message_at:'2026-10-04T00:00:00Z',updated_at:'2026-10-04T00:00:00Z',assignee:null,lifecycle:'open',needs_response:true,unread:1,human_takeover:false,kind:'comments',can_reply:true});
test('late concurrent 401 cannot reuse a refresh token already rotated by another request',async()=>{
 let current=session();let refreshes=0,expired=0;let firstDone!:()=>void;
 const done=new Promise<void>(r=>{firstDone=r});
 const transport=new HttpTransport(account,async()=>current,async s=>{current=s},()=>{expired++},(async(url:any,opts:any)=>{
  if(String(url).endsWith('/token')){refreshes++;if(refreshes>1)return response({error:'invalid_grant'},400);assert.equal(JSON.parse(opts.body).refresh_token,'opaque-refresh');return response({access_token:'rotated-access',refresh_token:'rotated-refresh',expires_in:3600})}
  if(opts.headers.Authorization==='Bearer opaque-access'){if(String(url).endsWith('/two'))await done;return response({error:'Sessão expirada.',code:'unauthorized'},401)}
  return response({ok:true});
 }) as typeof fetch);
 const first=transport.request({method:'GET',path:'/inbox/mobile/one'});
 const second=transport.request({method:'GET',path:'/inbox/mobile/two'});
 await first;firstDone();await second;assert.equal(refreshes,1);assert.equal(expired,0);
});
test('comment identity is explicit even when recipient contains the participant ID',()=>{const c=conversationFromApi(raw(1));assert.equal(c.kind,'comments');assert.equal(c.comment?.canPublic,false);assert.equal(c.comment?.canPrivate,true);assert.equal(c.mobile.avatarKey,undefined);assert.equal(c.contact,null)});
test('instance URLs cannot contain credentials or downgrade to HTTP',()=>{assert.equal(checkedOrigin('https://mautic.example/'),'https://mautic.example');assert.throws(()=>checkedOrigin('https://user:secret@mautic.example'));assert.throws(()=>checkedOrigin('http://mautic.example'));assert.throws(()=>checkedOrigin('https://mautic.example/?token=secret'))});
test('both conversation kinds resume independently without fetching a completed kind again',async()=>{const paths:string[]=[];const transport=new HttpTransport(account,async()=>session(),async()=>{},()=>{},(async(url:any,opts:any)=>{const u=new URL(String(url));paths.push(u.search);assert.equal(opts.headers.Authorization,'Bearer opaque-access');assert.equal(u.pathname,'/inbox/mobile/api/conversations');const comment=u.searchParams.get('kind')==='comments';return response({items:[{...raw(comment?3:u.searchParams.has('cursor')?2:1),kind:undefined}],next_cursor:!comment&&!u.searchParams.has('cursor')?'page2':null})}) as typeof fetch);const page=await transport.request<any>({method:'GET',path:'/inbox/api/conversations'});assert.equal(page.items.length,2);assert.equal(page.items.find((c:any)=>c.id===3).kind,'comments');assert.equal(page.items.find((c:any)=>c.id===1).kind,'inbox');assert.equal(page.complete,false);const tail=await transport.request<any>({method:'GET',path:'/inbox/api/conversations',query:{cursor:page.next_cursor}});assert.equal(tail.items[0].id,2);assert.equal(tail.items[0].kind,'inbox');assert.equal(paths.length,3);assert.equal(tail.next_cursor,null);assert.equal(tail.complete,true)});
test('repeated provider cursor fails rather than duplicating an endless list',async()=>{const transport=new HttpTransport(account,async()=>session(),async()=>{},()=>{},(async()=>response({items:[raw(1)],next_cursor:'same'})) as typeof fetch);await assert.rejects(transport.request({method:'GET',path:'/inbox/api/conversations',query:{cursor:JSON.stringify({version:1,private:null,comments:'same'})}}),(e:any)=>e.code==='cursor_loop')});
test('refresh rotates once for concurrent requests and writes only secure-session adapter',async()=>{let current={...session(),expiresAt:0};let refreshes=0,writes=0;const transport=new HttpTransport(account,async()=>current,async s=>{current=s;writes++},()=>{},(async(url:any,opts:any)=>{if(String(url).endsWith('/token')){refreshes++;await new Promise(r=>setTimeout(r,5));assert.equal(JSON.parse(opts.body).refresh_token,'opaque-refresh');return response({access_token:'rotated-access',refresh_token:'rotated-refresh',expires_in:3600})}assert.equal(opts.headers.Authorization,'Bearer rotated-access');return response({user:account.user})}) as typeof fetch);await Promise.all([transport.request({method:'GET',path:'/inbox/mobile/me'}),transport.request({method:'GET',path:'/inbox/mobile/me'})]);assert.equal(refreshes,1);assert.equal(writes,1);assert.equal(current.refreshToken,'rotated-refresh')});
test('uncertain sends are never retried automatically',async()=>{let sends=0;const transport=new HttpTransport(account,async()=>session(),async()=>{},()=>{},(async()=>{sends++;throw Error('connection dropped after send')}) as typeof fetch);await assert.rejects(transport.request({method:'POST',path:'/inbox/api/conversations/1/reply',body:{request_id:'stable-id',body:'controlled test'}}),(e:any)=>e instanceof ApiError&&e.status===0);assert.equal(sends,1)});
test('queue acceptance stays pending and does not claim delivery',async()=>{const transport=new HttpTransport(account,async()=>session(),async()=>{},()=>{},(async()=>response({status:'queued',request_id:'stable',item:{kind:'outbound',id:80,body:'controlled',status:'queued',timestamp:'2026-10-04T00:00:00Z'},summary:raw(1)},202)) as typeof fetch);const result=await transport.request<any>({method:'POST',path:'/inbox/api/conversations/1/reply',body:{request_id:'stable',body:'controlled'}});assert.equal(result.item.status,'pending');assert.equal(result.summary.id,1)});
test('GET agent catalog is not mistaken for a conversation',async()=>{const transport=new HttpTransport(account,async()=>session(),async()=>{},()=>{},(async()=>response({agents:[{key:'actual-key',name:'Actual agent',allowed:false}],assignment:null,can_assign:false})) as typeof fetch);const result=await transport.request<any>({method:'GET',path:'/inbox/api/conversations/1/ai'});assert.equal(result.agents[0].key,'actual-key');assert.equal(result.id,undefined)});
test('temporary refresh failure preserves session and cached access',async()=>{let expired=0,writes=0;const transport=new HttpTransport(account,async()=>({...session(),expiresAt:0}),async()=>{writes++},()=>{expired++},(async()=>response({error:'temporarily_unavailable'},503)) as typeof fetch);await assert.rejects(transport.request({method:'GET',path:'/inbox/mobile/me'}),(e:any)=>e instanceof ApiError&&e.status===503);assert.equal(expired,0);assert.equal(writes,0)});

test('connection discovery presents actionable errors instead of native URL and network failures',async()=>{
 assert.throws(()=>checkedOrigin(''),(e:any)=>e instanceof ApiError&&e.code==='invalid_url');
 assert.throws(()=>checkedOrigin('not a url'),(e:any)=>e instanceof ApiError&&e.message.includes('HTTPS válida'));
 const original=globalThis.fetch;
 try{globalThis.fetch=(async()=>{throw new TypeError('Failed to fetch')}) as typeof fetch;await assert.rejects(discover('https://mautic.example'),(e:any)=>e instanceof ApiError&&e.code==='discovery_unavailable');
 globalThis.fetch=(async()=>new Response('invalid json',{status:200})) as typeof fetch;await assert.rejects(discover('https://mautic.example'),(e:any)=>e.code==='invalid_config');
 globalThis.fetch=(async()=>response({...account.config,origin:account.origin,authorization_endpoint:'https://other.example/auth'})) as typeof fetch;await assert.rejects(discover('https://mautic.example'),(e:any)=>e.code==='invalid_endpoint');
 }finally{globalThis.fetch=original}
});

test('contact-origin QR chat becomes a normalized conversation while CRM pages stay CRM data',async()=>{
 const calls:{path:string;body:any}[]=[];
 const transport=new HttpTransport(account,async()=>session(),async()=>{},()=>{},(async(url:any,opts:any)=>{
  const u=new URL(String(url));calls.push({path:u.pathname+u.search,body:opts.body?JSON.parse(opts.body):undefined});
  if(u.pathname.endsWith('/start'))return response({...raw(269),channel:'whatsapp',kind:'inbox',origins:[{title:'WhatsApp QR'}],reply_blocked_reason:null});
  return response({items:[{id:8,name:'Contact',email:'contact@example.test',phone:''}],next_cursor:'8'});
 }) as typeof fetch);
 const crm=await transport.request<any>({method:'GET',path:'/inbox/mobile/contacts',query:{campaign_id:4,search:'Contact',cursor:'7'}});
 assert.equal(crm.items[0].name,'Contact');assert.equal(crm.next_cursor,'8');assert.match(calls[0].path,/campaign_id=4/);assert.equal(crm.items[0].kind,undefined);
 const c=await transport.request<any>({method:'POST',path:'/inbox/mobile/contacts/8/start',body:{channel_key:'qr:16'}});
 assert.equal(c.id,269);assert.equal(c.kind,'inbox');assert.equal(c.origins.campaign,'WhatsApp QR');assert.equal(c.mobile.window_open,true);assert.equal(calls[1].body.channel_key,'qr:16');assert.equal(calls.length,2);
});

test('API refusals identify HTTP category and diagnostics never retain sensitive request data',async()=>{
 for(const [status,words] of [[401,'sessão'],[403,'permissão'],[429,'muitas consultas'],[503,'histórico está salvo']] as const){const e=apiFailure(status,{errors:[{message:'internal exception SQL and private data'}]});assert.equal(e.status,status);assert.ok(e.message.includes(words));assert.ok(e.message.includes(String(status)));assert.ok(!e.message.includes('SQL'))}
 assert.equal(apiFailure(502,null).code,'api_error');
 const transport=new HttpTransport(account,async()=>session(),async()=>{},()=>{},(async()=>response({errors:[]},503)) as typeof fetch);
 await assert.rejects(transport.request({method:'POST',path:'/inbox/api/conversations/269/reply',query:{search:'private contact'},body:{body:'private message',request_id:'secret-request'}}));
 const failure=transport.diagnostic();assert.equal(failure?.status,503);assert.equal(failure?.resource,'/inbox/api/conversations/:id/reply');assert.ok(!JSON.stringify(failure).includes('private'));assert.ok(!JSON.stringify(failure).includes('269'));
});
