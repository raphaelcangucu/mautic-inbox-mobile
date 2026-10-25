import {t} from '../i18n/engine.ts';
import {ApiError,type Account,type ApiRequest,type Conversation,type Message} from './types.ts';
import {demoContacts,demoEmailAccounts,demoForms,emailSeed,type DemoContact,type DemoEmailAccount} from './fixtures.ts';
import {replySubject,EMAIL_BODY_MAX,EMAIL_SUBJECT_MAX} from './email.ts';
import type {ChannelOption} from './contact-channels.ts';

// Mock side of the Inbox 1.9 e-mail contract: CRM directory, channel sheet, start, forms, original link and reply.
export type EmailRemote={conversations:Conversation[];messages:Record<number,Message[]>;sequence:number;schema?:number;emailAccounts?:DemoEmailAccount[];contacts?:DemoContact[]};
/** Server texts for unavailable e-mail options (Inbox ContactDirectory). */
export const emailReasons={invalid:'Cadastre um e-mail válido no contato.',dnc:'O contato pediu para não receber e-mails.',inactive:'Esta conta de e-mail está desativada.'};
const validEmail=(value:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
/** Saved demo data from 1.0.x gains the e-mail conversations, accounts and directory contacts once. */
export function upgradeEmail(data:EmailRemote,account:Account){
 if((data.schema||0)<3){const fresh=emailSeed(account);for(const c of fresh.conversations)if(!data.conversations.some(x=>x.id===c.id)){data.conversations.push(c);data.messages[c.id]=fresh.messages[c.id]}data.schema=3}
 data.emailAccounts??=demoEmailAccounts(account);data.contacts??=demoContacts(account);
}
function directory(data:EmailRemote):DemoContact[]{
 const map=new Map<number,DemoContact>();
 for(const c of data.conversations)if(c.contact&&(c.kind||'inbox')==='inbox'&&!c.moderation?.spam&&!c.moderation?.blockedAuthor&&!map.has(c.contact.id))map.set(c.contact.id,{id:c.contact.id,name:c.contact.name||c.contact_name,email:c.contact.email||'',phone:c.contact.phone||''});
 for(const x of data.contacts||[])map.set(x.id,{...map.get(x.id),...x});
 return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')||a.id-b.id);
}
const related=(data:EmailRemote,contact:DemoContact)=>data.conversations.filter(c=>c.contact?.id===contact.id&&(c.kind||'inbox')==='inbox');
export function contactChannels(data:EmailRemote,contact:DemoContact):ChannelOption[]{
 const existing=related(data,contact);const email=contact.email.trim().toLowerCase();
 const options:ChannelOption[]=existing.map(c=>({key:'state:'+c.id,state_id:c.id,asset_id:c.asset.id,channel:c.channel,name:c.channel==='email'&&c.asset.address?c.asset.name+' · '+c.asset.address:c.asset.name,phone:c.asset.phone||null,address:c.asset.address||null,available:true,reason:null}));
 for(const account of data.emailAccounts||[]){
  if(existing.some(c=>c.channel==='email'&&c.asset.id===account.id&&c.recipient===email))continue;
  const reason=!account.active?emailReasons.inactive:!validEmail(email)?emailReasons.invalid:contact.dnc?emailReasons.dnc:null;
  options.push({key:'email:'+account.id,state_id:null,asset_id:account.id,channel:'email',name:account.name+' · '+account.address,phone:null,address:account.address,available:!reason,reason});
 }
 return options;
}
function startEmail(data:EmailRemote,a:Account,contact:DemoContact,assetId:number):Conversation{
 const account=data.emailAccounts?.find(x=>x.id===assetId);if(!account)throw new ApiError(404,'not_found',t('email.accountMissing'));
 const email=contact.email.trim().toLowerCase();
 const reason=!account.active?emailReasons.inactive:!validEmail(email)?emailReasons.invalid:contact.dnc?emailReasons.dnc:null;
 if(reason)throw new ApiError(422,'channel_unavailable',reason);
 const found=data.conversations.find(c=>c.channel==='email'&&c.asset.id===account.id&&c.recipient===email);
 if(found){if(found.contact&&found.contact.id!==contact.id)throw new ApiError(409,'contact_conflict',t('error.contact_conflict'));return found}
 // Starting never sends anything: the first e-mail goes out with the first reply.
 const now=new Date().toISOString();const id=Math.max(0,...data.conversations.map(c=>c.id))+1;
 const c:Conversation={id,conversation_id:100+id,version:1,channel:'email',kind:'inbox',contact_name:contact.name,preview:'',subject:null,avatar_url:null,asset:{id:account.id,name:account.name,type:'email_account',address:account.address},recipient:email,assignee:{id:a.user.id,name:a.user.name},lifecycle:'open',needs_response:false,unread:0,human_takeover:true,last_message_at:now,updated_at:now,contact:{id:contact.id,name:contact.name,email:contact.email,phone:contact.phone},origins:{campaign:account.name},can_reply:true,reply_blocked_reason:null,email:{inbound:'ok',inbound_since:null},moderation:{spam:false,hidden:false,blockedAuthor:false},mobile:{ai:false,window_open:true,attachments:false}};
 data.conversations.push(c);data.messages[id]=[];return c;
}
export function emailFeature(data:EmailRemote,a:Account,r:ApiRequest):unknown|undefined{
 const b=r.body||{};
 if(r.path==='/inbox/mobile/contacts'&&r.method==='GET'){
  const query=String(r.query?.search||'').trim().toLocaleLowerCase('pt-BR');const limit=Math.max(1,Math.min(50,Number(r.query?.limit)||30));const offset=Math.max(0,Number(r.query?.cursor)||0);
  const campaign=Number(r.query?.campaign_id||0),segment=Number(r.query?.segment_id||0);const names={campaign:['','Relatório da rodada','Boas-vindas'],segment:['','Interessados em futebol','Atendimento ativo']};
  const rows=directory(data).filter(x=>(!query||[x.name,x.email,x.phone].some(v=>v.toLocaleLowerCase('pt-BR').includes(query)))&&(!campaign||related(data,x).some(c=>c.origins.campaign===names.campaign[campaign]||c.campaigns?.includes(names.campaign[campaign])))&&(!segment||related(data,x).some(c=>c.segments?.includes(names.segment[segment]))));
  return {items:rows.slice(offset,offset+limit).map(({id,name,email,phone})=>({id,name,email,phone})),next_cursor:offset+limit<rows.length?String(offset+limit):null};
 }
 const route=r.path.match(/^\/inbox\/mobile\/contacts\/([1-9][0-9]*)(?:\/(start))?$/);
 if(route){
  const contact=directory(data).find(x=>x.id===Number(route[1]));if(!contact)throw new ApiError(404,'not_found',t('error.not_found'));
  if(!route[2]&&r.method==='GET'){const campaigns=[...new Set(related(data,contact).flatMap(c=>[c.origins.campaign,...(c.campaigns||[])]).filter(Boolean))];return {id:contact.id,name:contact.name,email:contact.email,phone:contact.phone,campaigns:campaigns.map((name,i)=>({id:i+1,name})),channels:contactChannels(data,contact)}}
  if(route[2]==='start'&&r.method==='POST'){
   const key=String(b.channel_key||'');const state=/^state:([1-9][0-9]*)$/.exec(key);const email=/^email:([1-9][0-9]*)$/.exec(key);
   if(state){const c=related(data,contact).find(x=>x.id===Number(state[1]));if(!c)throw new ApiError(404,'not_found',t('error.not_found'));return c}
   if(email)return startEmail(data,a,contact,Number(email[1]));
   throw new ApiError(422,'channel_unavailable',t('email.channelUnavailable'));
  }
  throw new ApiError(405,'method',t('error.action'));
 }
 if((r.path==='/inbox/mobile/forms'||r.path==='/inbox/api/forms')&&r.method==='GET')return demoForms;
 const original=r.path.match(/^\/inbox\/mobile\/messages\/([1-9][0-9]*)\/original-link$/);
 if(original&&r.method==='POST'){
  const found=Object.values(data.messages).flat().find(m=>String(m.id)===original[1]&&(m.email?.has_original||m.email?.has_html));
  if(!found)throw new ApiError(404,'not_found',t('email.originalUnavailable'));
  // The demo has no signed page to open in the system browser.
  throw new ApiError(409,'original_demo',t('email.originalDemo'));
 }
 return undefined;
}
/** Reply on an e-mail conversation: optional subject ("Re: …" fallback) and survey markers expanded into the contact's link. */
export function emailReply(c:Conversation,a:Account,body:string,requested:unknown){
 const subject=String(requested||'').replace(/\s+/g,' ').trim()||replySubject(c.subject);
 if(!subject)throw new ApiError(422,'subject_required',t('email.subjectRequired'));
 if(subject.length>EMAIL_SUBJECT_MAX)throw new ApiError(422,'subject_too_long',t('email.subjectTooLong'));
 const expanded=body.replace(/\[\[form:([0-9]+)\]\]/g,(_,id)=>{const form=demoForms.find(f=>f.id===Number(id));if(!form)throw new ApiError(422,'form_unavailable',t('email.formUnavailable'));return `[${form.name}](${a.origin}/inbox/f/demo-${form.id})`});
 if(expanded.length>EMAIL_BODY_MAX)throw new ApiError(422,'invalid_body',t('error.invalid_body'));
 return {body:expanded,subject,email:{from:{name:a.user.name+' · '+c.asset.name,address:c.asset.address||''},to:[{name:c.contact_name,address:c.recipient}],cc:[],quoted:null,has_html:true,has_original:false,auto_reply:false,unverified_sender:false,kind:'message'}};
}
