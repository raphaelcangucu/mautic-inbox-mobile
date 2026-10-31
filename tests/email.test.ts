import test from 'node:test';
import assert from 'node:assert/strict';
import {HttpTransport,conversationFromApi,messageFromApi} from '../src/api/http.ts';
import {MockTransport} from '../src/api/mock.ts';
import {InboxRepository} from '../src/api/repository.ts';
import {demoAccounts,seed} from '../src/api/fixtures.ts';
import {emailReasons} from '../src/api/mock-email.ts';
import {conversationConnection,conversationSearch} from '../src/api/conversation-connection.ts';
import {channelOptionLabel,withStarted,type ChannelOption} from '../src/api/contact-channels.ts';
import {messageDocument,type MessageNode} from '../src/components/message-format.ts';
import {attachmentChips,bodyImages,checkedOriginalUrl,composeError,emailImageKind,emailSnippet,emailThreadRows,emailTimelineMessages,formsFromApi,hasRemoteImages,originalAvailable,originalLink,pushPreview,replySubject,saveEmailShortcut,threadSubject,withFormMarker} from '../src/api/email.ts';
import {visibleChatMessages} from '../src/components/chat-timeline.ts';
import {channels,defaultView,migrateView,type Account,type Conversation,type Message,type Page,type Session,type ViewState} from '../src/api/types.ts';
import type {Storage} from '../src/storage/interface.ts';

class Memory implements Storage{
 data=new Map<string,unknown>();async get<T>(k:string){return this.data.has(k)?structuredClone(this.data.get(k)) as T:null}
 async put(k:string,v:unknown){this.data.set(k,structuredClone(v))}async remove(k:string){this.data.delete(k)}
 async scan<T>(p:string){return [...this.data].filter(([k])=>k.startsWith(p)).map(([,v])=>structuredClone(v) as T)}async clear(){this.data.clear()}async close(){}
}
const account:Account={id:'email-live',origin:'https://mautic.example',name:'Test',mode:'live',user:{id:7,name:'Ana',email:'ana@example.test'},config:{version:1,name:'Test',origin:'https://mautic.example',api_base:'https://mautic.example/inbox/mobile/api',token_endpoint:'https://mautic.example/inbox/mobile/token',authorization_endpoint:'https://mautic.example/s/inbox/mobile/authorize',redirect_uri:'mautic-inbox-demo://oauth/callback',capabilities:{channels:['whatsapp','email']}}};
const session=():Session=>({accessToken:'opaque-access',refreshToken:'opaque-refresh',expiresAt:Date.now()+3600000});
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const flatten=(nodes:MessageNode[]):MessageNode[]=>nodes.flatMap(n=>[n,...flatten(n.children)]);
function mock(i=0){const disk=new Memory();const api=new MockTransport(demoAccounts[i],disk);api.latency=0;return {disk,api,repo:new InboxRepository(disk,api)}}
// Contract examples from the Inbox 1.9 spec ("Contrato entre os repositórios").
const summary={id:812,conversation_id:900,version:3,channel:'email',kind:'inbox',contact_name:'João Lead',recipient:'joao@example.com',asset:{id:31,name:'Macro Markets',type:'email_account',address:'contato@macromarkets.com'},subject:'Re: Por que você ainda não depositou?',email:{inbound:'ok',inbound_since:null},assignee:null,lifecycle:'open',needs_response:true,unread:1,human_takeover:false,last_message_at:'2026-10-24T10:00:00Z',updated_at:'2026-10-24T10:00:00Z',can_reply:true,reply_blocked_reason:null,preview:'Oi Ana, ainda estou decidindo.'};
const item={kind:'message',id:5001,direction:'inbound',timestamp:'2026-10-24T10:00:00Z',status:'received',body:'Oi Ana, ainda estou decidindo. **Qual o depósito mínimo?**',subject:'Re: Por que você ainda não depositou?',html:'<div onclick="x()">raw</div>',email:{from:{name:'João Lead',address:'joao@example.com'},to:[{name:'Macro Markets',address:'contato@macromarkets.com'}],cc:[],quoted:'> Em 23/10, Ana escreveu: …',has_html:true,has_original:true,auto_reply:false,unverified_sender:false,kind:'message'},attachments:[{type:'document',label:'extrato.pdf',url:'https://mautic.example/inbox/mobile/api/email/5001/attachments/0',available:true,size:183422,mime:'application/pdf'},{type:'image',label:'foto.jpg',url:'https://mautic.example/inbox/mobile/api/email/5001/attachments/1',available:true,size:2048},{type:'document',label:'macro.xlsm',url:null,available:false,size:44120,mime:'application/vnd.ms-excel.sheet.macroEnabled.12'}]};

test('timeline mapping keeps subject, e-mail details and every attachment, never raw HTML',()=>{
 const m=messageFromApi(item);
 assert.equal(m.subject,'Re: Por que você ainda não depositou?');assert.equal(m.body,item.body);assert.equal((m as any).html,undefined);
 assert.equal(m.email?.from?.address,'joao@example.com');assert.equal(m.email?.to?.[0].address,'contato@macromarkets.com');assert.equal(m.email?.quoted,'> Em 23/10, Ana escreveu: …');assert.equal(m.email?.has_original,true);assert.equal(m.email?.unverified_sender,false);
 assert.equal(m.attachments?.length,3);assert.deepEqual(m.attachments!.map(a=>a.name),['extrato.pdf','foto.jpg','macro.xlsm']);
 assert.equal(m.attachments![1].mime,'image/jpeg');assert.equal(m.attachments![2].available,false);assert.equal(m.attachments![2].uri,undefined);assert.equal(m.attachments![0].size,183422);
 assert.equal(m.attachment?.name,'extrato.pdf');
 // Other channels keep the single-attachment shape they had.
 const audio=messageFromApi({kind:'message',id:2,body:'',timestamp:'2026-10-24T10:00:00Z',attachments:[{type:'audio',label:'voz.m4a',url:'https://mautic.example/s/inbox/api/media/9'}]});
 assert.equal(audio.attachment?.mime,'audio/mpeg');assert.equal(audio.attachments?.length,1);assert.equal(audio.email,undefined);
 assert.equal(messageFromApi({kind:'message',id:3,body:'x',timestamp:'2026-10-24T10:00:00Z',email:{auto_reply:true}}).email?.kind,'auto_reply');
 // "View original" follows has_original; a server that only sends has_html still offers it.
 assert.equal(originalAvailable(m),true);assert.equal(originalAvailable({...m,id:'local-1'}),false);
 assert.equal(originalAvailable(messageFromApi({...item,email:{...item.email,has_original:false}})),false);
 assert.equal(originalAvailable(messageFromApi({...item,email:{from:item.email.from,has_html:true}})),true);
});
test('conversation summary keeps subject, account address and delayed inbound state',()=>{
 const c=conversationFromApi({...summary,email:{inbound:'delayed',inbound_since:'2026-10-24T09:00:00Z'}});
 assert.equal(c.channel,'email');assert.equal(c.subject,'Re: Por que você ainda não depositou?');assert.equal(c.asset.address,'contato@macromarkets.com');assert.equal(c.email?.inbound,'delayed');assert.equal(c.kind,'inbox');
 assert.equal(conversationConnection(c).label,'Macro Markets · contato@macromarkets.com');assert.equal(conversationConnection(c).phone,'');
 assert.equal(conversationSearch(c,'contato@macromarkets'),true);assert.equal(conversationSearch(c,'depositou'),true);
 assert.equal(channels.email,'E-mail');
});
test('e-mail attachments use the authenticated proxy only on the account origin',async()=>{
 const api=new HttpTransport(account,async()=>session(),async()=>{},()=>{});
 const mobile=await api.mediaSource('/inbox/mobile/api/email/5001/attachments/2');assert.equal(mobile.uri,'https://mautic.example/inbox/mobile/api/email/5001/attachments/2');assert.equal(mobile.headers?.Authorization,'Bearer opaque-access');
 const web=await api.mediaSource('https://mautic.example/s/inbox/api/email/5001/attachments/0');assert.equal(web.uri,'https://mautic.example/inbox/mobile/api/email/5001/attachments/0');assert.ok(web.headers);
 for(const uri of ['https://evil.example/inbox/mobile/api/email/5001/attachments/0','https://mautic.example/inbox/mobile/api/email/5001/attachments/0?x=1','https://mautic.example/inbox/mobile/api/email/abc/attachments/0'])assert.equal((await api.mediaSource(uri)).headers,undefined,uri);
});
test('saved channel filter from 1.0.x gains e-mail; a later choice to hide e-mail is respected',async()=>{
 const legacy=migrateView({kind:'inbox',filter:'Minhas',search:'ana',channels:['whatsapp','instagram','facebook','webchat'],listOffset:0,railOffset:0,chatOffsets:{},chatAnchors:{}} as ViewState);
 assert.ok(legacy.channels.includes('email'));assert.equal(legacy.filter,'Minhas');assert.equal(legacy.search,'ana');assert.deepEqual(legacy.channelsKnown,Object.keys(channels));
 const narrowed=migrateView({channels:['whatsapp']} as ViewState);assert.deepEqual(narrowed.channels,['whatsapp','email']);
 const hidden=migrateView({...defaultView(),channels:['whatsapp','instagram']});assert.deepEqual(hidden.channels,['whatsapp','instagram']);
 assert.deepEqual(migrateView(null).channels,Object.keys(channels));assert.deepEqual(migrateView({channels:['bogus' as any]} as ViewState).channels,Object.keys(channels));
 const disk=new Memory();await disk.put('ui:view',{kind:'inbox',filter:'Todas',search:'',channels:['whatsapp','webchat'],listOffset:0,railOffset:0,chatOffsets:{},chatAnchors:{}});
 const repo=new InboxRepository(disk,{request:async()=>{throw Error('unused')}});assert.deepEqual((await repo.view()).channels,['whatsapp','webchat','email']);
});
test('reply sends the optional subject only for replies and keeps it on the optimistic item',async()=>{
 const disk=new Memory();const bodies:any[]=[];const repo=new InboxRepository(disk,{request:async<T>(r:any)=>{bodies.push(r.body);return {item:{kind:'outbound',id:77,body:r.body.body,subject:r.body.subject,timestamp:'2026-10-24T10:01:00Z',status:'pending'}} as T}});
 await repo.send({request_id:'email-reply-0001',conversationId:812,body:'Mínimo de R$ 100.',mode:'reply',timestamp:'2026-10-24T10:01:00Z',status:'sending',replyMode:'private',subject:'  Re: Depósito  '});
 assert.equal(bodies[0].subject,'Re: Depósito');assert.equal(bodies[0].request_id,'email-reply-0001');assert.equal((await repo.cachedMessages(812))[0].subject,'Re: Depósito');
 await repo.send({request_id:'email-note-0001',conversationId:812,body:'Nota',mode:'note',timestamp:'2026-10-24T10:02:00Z',status:'sending',subject:'ignored'});assert.equal(bodies[1].subject,undefined);
 await repo.send({request_id:'whatsapp-reply-1',conversationId:1,body:'Oi',mode:'reply',timestamp:'2026-10-24T10:03:00Z',status:'sending'});assert.equal('subject' in bodies[2],false);
 // HTTP transport maps the 202 outbound item with its subject.
 const transport=new HttpTransport(account,async()=>session(),async()=>{},()=>{},(async(_:any,opts:any)=>{const body=JSON.parse(opts.body);return json({status:'queued',request_id:body.request_id,item:{kind:'outbound',id:91,body:body.body,subject:body.subject,status:'queued',timestamp:'2026-10-24T10:01:00Z',email:{from:{name:'Ana · Macro Markets',address:'contato@macromarkets.com'},to:[{name:'João Lead',address:'joao@example.com'}]}},summary},202)}) as typeof fetch);
 const result=await transport.request<any>({method:'POST',path:'/inbox/api/conversations/812/reply',body:{body:'Oi',request_id:'stable-email-1',subject:'Re: Teste'}});
 assert.equal(result.item.subject,'Re: Teste');assert.equal(result.item.status,'pending');assert.equal(result.item.email.to[0].address,'joao@example.com');assert.equal(result.summary.subject,summary.subject);
});
test('demo e-mail thread: realistic conversations, Gmail grouping and the mock reply contract',async()=>{
 const {api,repo}=mock();const list=await repo.list();const email=list.filter(c=>c.channel==='email');
 assert.equal(email.length,2);const thread=email.find(c=>c.id===8)!;assert.equal(thread.subject,'Re: Por que você ainda não depositou?');assert.equal(thread.asset.address,'contato@macromarkets.com');assert.equal(email.find(c=>c.id===9)!.email?.inbound,'delayed');
 const history=await api.request<Page<Message>>({method:'GET',path:'/inbox/api/conversations/8/history'});const items=history.items;
 assert.ok(items.filter(m=>m.kind==='message'||m.kind==='outbound').length>=4);assert.ok(items.some(m=>m.email?.auto_reply));assert.ok(items.some(m=>m.email?.quoted));assert.ok(items.some(m=>(m.attachments?.length||0)>1));assert.ok(items.some(m=>/respondeu o formulário/.test(m.body)));
 const rows=emailThreadRows(items,thread);
 assert.equal(rows[0].type,'group');assert.equal((rows[0] as any).count,5);assert.equal(rows.at(-1)?.type,'card');assert.equal((rows.at(-1) as any).open,true);assert.ok(rows.some(r=>r.type==='note'));assert.ok(rows.some(r=>r.type==='event'));
 const expanded=emailThreadRows(items,thread,{},new Set([rows[0].key]));assert.ok(expanded.some(r=>r.type==='event'&&/Resposta automática/.test(r.text)));assert.equal(expanded.filter(r=>r.type==='card'&&!r.open).length,5);
 const opened=emailThreadRows(items,thread,{'message:9003':true},new Set([rows[0].key]));assert.equal(opened.find(r=>r.key==='message:9003')?.type==='card'&&(opened.find(r=>r.key==='message:9003') as any).open,true);
 assert.equal(threadSubject(thread,items),'Re: Por que você ainda não depositou?');
 // Reply with an explicit subject, a survey marker and the "Re:" fallback.
 const sent=await api.request<any>({method:'POST',path:'/inbox/api/conversations/8/reply',body:{body:'Veja: [[form:12]]',request_id:'email-demo-0001',subject:'Transferência de custódia'}});
 assert.equal(sent.item.subject,'Transferência de custódia');assert.equal(sent.summary.subject,'Transferência de custódia');assert.match(sent.item.body,/\[Pesquisa: por que não depositou\]\(https:\/\/macro\.demo\.invalid\/inbox\/f\/demo-12\)/);assert.equal(sent.item.email.from.address,'contato@macromarkets.com');assert.equal(sent.item.email.to[0].address,thread.recipient);
 const fallback=await api.request<any>({method:'POST',path:'/inbox/api/conversations/8/reply',body:{body:'Sem assunto',request_id:'email-demo-0002'}});assert.equal(fallback.item.subject,'Re: Transferência de custódia');
 await assert.rejects(api.request({method:'POST',path:'/inbox/api/conversations/8/reply',body:{body:'[[form:999]]',request_id:'email-demo-0003'}}),(e:any)=>e.code==='form_unavailable');
 const whatsapp=await api.request<any>({method:'POST',path:'/inbox/api/conversations/1/reply',body:{body:'Oi',request_id:'whatsapp-demo-01',subject:'ignored'}});assert.equal(whatsapp.item.subject,undefined);
});
test('channel sheet offers e-mail accounts with server reasons and start opens one lowercase conversation',async()=>{
 const {api}=mock();
 const marina=await api.request<any>({method:'GET',path:'/inbox/mobile/contacts/200'});
 const options=marina.channels as ChannelOption[];assert.ok(options.some(o=>o.key==='state:1'&&o.channel==='whatsapp'));
 const main=options.find(o=>o.key==='email:31')!;assert.deepEqual({state_id:main.state_id,asset_id:main.asset_id,channel:main.channel,name:main.name,address:main.address,available:main.available,reason:main.reason},{state_id:null,asset_id:31,channel:'email',name:'Macro Markets · contato@macromarkets.com',address:'contato@macromarkets.com',available:true,reason:null});
 assert.equal(options.find(o=>o.key==='email:33')?.reason,emailReasons.inactive);assert.equal(channelOptionLabel(main),'E-mail · Macro Markets · contato@macromarkets.com');
 assert.equal(channelOptionLabel({...main,name:'Macro Markets'}),'E-mail · Macro Markets · contato@macromarkets.com');assert.equal(channelOptionLabel({...main,channel:'whatsapp',name:'Suporte',phone:'+5511999990000'}),'Suporte · +5511999990000');
 const contacts=await api.request<Page<any>>({method:'GET',path:'/inbox/mobile/contacts',query:{search:'',segment_id:0,campaign_id:0,limit:30}});
 const noEmail=contacts.items.find(x=>x.email==='')!;const dnc=(await api.request<Page<any>>({method:'GET',path:'/inbox/mobile/contacts',query:{search:'carla.nunes'}})).items[0];
 assert.equal((await api.request<any>({method:'GET',path:`/inbox/mobile/contacts/${noEmail.id}`})).channels.find((o:ChannelOption)=>o.key==='email:31').reason,emailReasons.invalid);
 assert.equal((await api.request<any>({method:'GET',path:`/inbox/mobile/contacts/${dnc.id}`})).channels.find((o:ChannelOption)=>o.key==='email:31').reason,emailReasons.dnc);
 await assert.rejects(api.request({method:'POST',path:`/inbox/mobile/contacts/${dnc.id}/start`,body:{channel_key:'email:31'}}),(e:any)=>e.status===422&&e.message===emailReasons.dnc);
 await assert.rejects(api.request({method:'POST',path:'/inbox/mobile/contacts/200/start',body:{channel_key:'email:33'}}),(e:any)=>e.message===emailReasons.inactive);
 const started=await api.request<Conversation>({method:'POST',path:'/inbox/mobile/contacts/200/start',body:{channel_key:'email:31'}});
 assert.equal(started.channel,'email');assert.equal(started.recipient,'contato0@example.com');assert.equal(started.asset.address,'contato@macromarkets.com');assert.equal(started.contact?.id,200);
 const history=await api.request<Page<Message>>({method:'GET',path:`/inbox/api/conversations/${started.id}/history`});assert.equal(history.items.length,0);
 assert.equal((await api.request<Conversation>({method:'POST',path:'/inbox/mobile/contacts/200/start',body:{channel_key:'email:31'}})).id,started.id);
 const after=(await api.request<any>({method:'GET',path:'/inbox/mobile/contacts/200'})).channels as ChannelOption[];assert.ok(after.some(o=>o.key==='state:'+started.id&&o.channel==='email'));assert.equal(after.some(o=>o.key==='email:31'),false);
 // The first e-mail of a new conversation needs a subject.
 await assert.rejects(api.request({method:'POST',path:`/inbox/api/conversations/${started.id}/reply`,body:{body:'Olá',request_id:'email-first-001'}}),(e:any)=>e.code==='subject_required');
 const first=await api.request<any>({method:'POST',path:`/inbox/api/conversations/${started.id}/reply`,body:{body:'Olá, Marina!',request_id:'email-first-002',subject:'Boas-vindas'}});assert.equal(first.summary.subject,'Boas-vindas');
 assert.equal(withStarted([summary as any],started)[0].id,started.id);assert.equal(withStarted([started],{...started,subject:'x'}).length,1);
});
test('a started conversation stays in the cached list until the next full sync',async()=>{
 const {api,repo}=mock();await repo.list();
 const started=await api.request<Conversation>({method:'POST',path:'/inbox/mobile/contacts/232/start',body:{channel_key:'email:31'}});
 assert.equal((await repo.cachedList()).some(c=>c.id===started.id),false);
 await repo.adopt(started);await repo.adopt(started);
 const cached=await repo.cachedList();assert.equal(cached.filter(c=>c.id===started.id).length,1);assert.equal(cached.find(c=>c.id===started.id)?.recipient,'ana.rocha@example.com');
 assert.ok((await repo.list()).some(c=>c.id===started.id));
});
test('HTTP transport writes the mobile paths for start, forms and the original link',async()=>{
 const calls:{path:string;method:string;body?:any}[]=[];
 const transport=new HttpTransport(account,async()=>session(),async()=>{},()=>{},(async(url:any,opts:any)=>{const u=new URL(String(url));calls.push({path:u.pathname,method:opts.method,body:opts.body?JSON.parse(opts.body):undefined});
  if(u.pathname.endsWith('/start'))return json(summary);if(u.pathname.endsWith('/forms'))return json([{id:12,name:'Pesquisa: por que não depositou'},{id:'x',name:'bad'}]);
  if(u.pathname.endsWith('/original-link'))return json({url:'https://mautic.example/inbox/mobile/original/abc123',expires_at:'2026-10-24T10:05:00Z'});return json({},404)}) as typeof fetch);
 const c=await transport.request<Conversation>({method:'POST',path:'/inbox/mobile/contacts/8/start',body:{channel_key:'email:31'}});
 assert.equal(c.channel,'email');assert.equal(c.subject,summary.subject);assert.equal(calls[0].path,'/inbox/mobile/api/contacts/8/start');assert.equal(calls[0].body.channel_key,'email:31');
 assert.deepEqual(formsFromApi(await transport.request({method:'GET',path:'/inbox/mobile/forms'})),[{id:12,name:'Pesquisa: por que não depositou'}]);assert.equal(calls[1].path,'/inbox/mobile/api/forms');
 assert.equal(await originalLink(transport,account,5001),'https://mautic.example/inbox/mobile/original/abc123');assert.equal(calls[2].path,'/inbox/mobile/api/messages/5001/original-link');assert.equal(calls[2].method,'POST');
 await assert.rejects(originalLink(transport,account,'local-abc'),(e:any)=>e.code==='invalid_message');
 for(const bad of ['http://mautic.example/inbox/mobile/original/x','https://evil.example/inbox/mobile/original/x','https://user:pw@mautic.example/x',null])assert.throws(()=>checkedOriginalUrl(bad,account),String(bad));
});
test('demo forms, original link and 1.0.x saved demo data',async()=>{
 const {api,disk}=mock();
 assert.deepEqual(formsFromApi(await api.request({method:'GET',path:'/inbox/mobile/forms'})).map(f=>f.id),[12,14]);
 await assert.rejects(api.request({method:'POST',path:'/inbox/mobile/messages/9010/original-link'}),(e:any)=>e.code==='original_demo');
 await assert.rejects(api.request({method:'POST',path:'/inbox/mobile/messages/1/original-link'}),(e:any)=>e.status===404);
 // A store saved by 1.0.x (schema 2, no e-mail) is upgraded once, without duplicates.
 const legacy=seed(demoAccounts[0]);await disk.put('mock:remote',{conversations:legacy.conversations.filter(c=>c.channel!=='email'),messages:Object.fromEntries(Object.entries(legacy.messages).filter(([id])=>Number(id)<8)),sequence:1000,schema:2});
 const page=await api.request<Page<Conversation>>({method:'GET',path:'/inbox/api/conversations'});assert.equal(page.items.filter(c=>c.channel==='email').length,2);
 const again=await api.request<Page<Conversation>>({method:'GET',path:'/inbox/api/conversations'});assert.equal(again.items.length,page.items.length);assert.equal((await disk.get<any>('mock:remote')).schema,3);
});
test('simulated inbound e-mail carries the thread subject and sender',async()=>{
 const {api}=mock();await api.request({method:'GET',path:'/inbox/api/conversations'});const injected=await api.inject(9,'Ainda aguardo o retorno.');
 assert.equal(injected?.subject,'Re: Cobrança de taxa de custódia');assert.equal(injected?.email?.from?.address,'fernanda.lima@example.com');
});
test('e-mail helpers: subject, excerpt, images, chips, push text, survey marker and compose validation',()=>{
 assert.equal(replySubject('Depósito'),'Re: Depósito');assert.equal(replySubject('Re: Depósito'),'Re: Depósito');assert.equal(replySubject('RES: Depósito'),'RES: Depósito');assert.equal(replySubject('  '),'');assert.equal(replySubject(null),'');
 assert.equal(emailSnippet('**Olá**, veja [o link](https://x.example) e ![gráfico](https://x.example/a.png)\n\n> citado'),'Olá, veja o link e gráfico citado');
 assert.equal(saveEmailShortcut('Fale com joao@example.com','email'),undefined);assert.equal(saveEmailShortcut('Fale com joao@example.com','whatsapp'),'joao@example.com');assert.equal(saveEmailShortcut('Fale com joao@example.com'),'joao@example.com');
 assert.equal(pushPreview({channel:'email',subject:'Re: Depósito',preview:'Qual o mínimo?'}),'Re: Depósito · Qual o mínimo?');assert.equal(pushPreview({channel:'whatsapp',subject:'x',preview:'Oi'}),'Oi');
 const attachments=[{name:'g.png',uri:'https://mautic.example/inbox/mobile/api/email/1/attachments/0',mime:'image/png'}];
 assert.equal(emailImageKind('https://mautic.example/inbox/mobile/api/email/1/attachments/0',account,attachments),'attachment');
 assert.equal(emailImageKind('/inbox/mobile/api/email/1/attachments/3',account),'attachment');assert.equal(emailImageKind('https://mautic.example/s/inbox/api/email/1/attachments/0',account),'attachment');
 assert.equal(emailImageKind('https://tracker.example/pixel.gif',account),'remote');assert.equal(emailImageKind('http://tracker.example/pixel.gif',account),null);assert.equal(emailImageKind('cid:logo',account),null);assert.equal(emailImageKind('/s/other',account),null);
 const body='Oi\n\n![g](https://mautic.example/inbox/mobile/api/email/1/attachments/0)\n\n![logo](https://tracker.example/logo.png)';
 assert.deepEqual(bodyImages(body),['https://mautic.example/inbox/mobile/api/email/1/attachments/0','https://tracker.example/logo.png']);assert.equal(hasRemoteImages(body,account,attachments),true);assert.equal(hasRemoteImages('![g](https://mautic.example/inbox/mobile/api/email/1/attachments/0)',account,attachments),false);
 const message:Message={kind:'message',id:1,body,timestamp:'2026-10-24T10:00:00Z',attachments:[...attachments,{name:'a.pdf',uri:'https://mautic.example/inbox/mobile/api/email/1/attachments/1',mime:'application/pdf'}]};assert.deepEqual(attachmentChips(message).map(a=>a.name),['a.pdf']);
 const images=flatten(messageDocument(body,'email')).filter(n=>n.type==='image');assert.equal(images[0].href,'https://mautic.example/inbox/mobile/api/email/1/attachments/0');assert.equal(images[0].text,'g');
 assert.equal(flatten(messageDocument('![x](javascript:alert(1)) ![y](http://plain.example/a.png)')).filter(n=>n.type==='image').some(n=>n.href),false);
 assert.equal(withFormMarker('',12),'[[form:12]]');assert.equal(withFormMarker('Responda:  \n',12),'Responda:\n\n[[form:12]]');assert.throws(()=>withFormMarker('x'.repeat(3995),12),/form_too_long/);
 assert.match(composeError('','Re: x','x')!,/texto/);assert.match(composeError('Oi','','')!,/assunto/);assert.equal(composeError('Oi','','Depósito'),null);assert.equal(composeError('Oi','Novo','') ,null);assert.match(composeError('x'.repeat(4001),'a','a')!,/4\.000/);
});

test('server e-mail events (form, campaign) get their text in the thread; other textless events stay hidden',()=>{
 const at='2026-10-24T04:02:00Z';
 const items:Message[]=[
  {kind:'event',id:1,body:'',timestamp:at,event:'form_opened',form:{id:3,name:'Pesquisa'}},
  {kind:'event',id:2,body:'',timestamp:at,event:'form_submitted',form:{id:3,name:'Pesquisa'},answers:[{label:'Principal motivo',value:'Ainda comparando corretoras'}]},
  {kind:'event',id:3,body:'',timestamp:at,event:'campaign_email_started',campaign:{id:9,name:'Depósito'}},
  {kind:'event',id:4,body:'',timestamp:at,event:'reply_requested'},
 ];
 const visible=visibleChatMessages(emailTimelineMessages(items,{contact_name:'João Ribeiro',recipient:'lead@example.test'}));
 assert.deepEqual(visible.map(m=>m.id),[1,2,3]);
 assert.equal(visible[0].body,'João Ribeiro abriu o formulário Pesquisa');
 assert.equal(visible[1].body,'João Ribeiro respondeu o formulário Pesquisa · Principal motivo: Ainda comparando corretoras');
 assert.equal(visible[2].body,'Conversa iniciada pela campanha Depósito');
});
