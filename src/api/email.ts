import {t} from '../i18n/engine.ts';
import {ApiError,messageKey,type Account,type Attachment,type Channel,type Conversation,type EmailAddress,type Message,type Transport} from './types.ts';

// E-mail channel helpers (Inbox 1.9 contract). Pure functions; the screens only render their result.
export const EMAIL_BODY_MAX=4000;
export const EMAIL_SUBJECT_MAX=255;
const replied=/^(re|res|resp|aw|sv)\s*:/i;
/** One "Re:" prefix, never "Re: Re:"; an empty subject stays empty. */
export function replySubject(subject?:string|null){const value=(subject||'').replace(/\s+/g,' ').trim();if(!value)return '';return replied.test(value)?value:'Re: '+value}
/** Subject of the latest message, as the server does for the summary. */
export function threadSubject(conversation:Pick<Conversation,'subject'>,messages:Message[]){for(let i=messages.length-1;i>=0;i--){const m=messages[i];if(m.kind!=='event'&&m.kind!=='note'&&m.subject?.trim())return m.subject.trim()}return conversation.subject?.trim()||''}
export const isEmailConversation=(c?:Pick<Conversation,'channel'>|null)=>c?.channel==='email';
/** The CRM "save e-mail" shortcut would fire on every signature in the e-mail channel. */
export function saveEmailShortcut(body:string,channel?:Channel){if(channel==='email')return undefined;return body.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]}
/** Android local notification body: subject first, then the excerpt. */
export function pushPreview(c:Pick<Conversation,'channel'|'subject'|'preview'>){const subject=c.channel==='email'?c.subject?.trim():'';return subject?subject+(c.preview?' · '+c.preview:''):c.preview}
/** Plain one-line excerpt of server markdown. */
export function emailSnippet(body:string,max=140){const text=body.replace(/!\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/\[\[form:\d+\]\]/g,'').replace(/^\s{0,3}(?:>+|#{1,6}|[-*+]|\d+[.)])\s*/gm,'').replace(/(\*\*|__|~~|`)/g,'').replace(/(^|\W)[*_](\S)/g,'$1$2').replace(/(\S)[*_](?=\W|$)/g,'$1').replace(/\s+/g,' ').trim();return text.length>max?text.slice(0,max-1).trimEnd()+'…':text}
export const addressLabel=(a?:EmailAddress|null)=>!a?'':a.name?.trim()&&a.name.trim()!==a.address?`${a.name.trim()} <${a.address}>`:a.address;
export const addressName=(a?:EmailAddress|null)=>a?.name?.trim()||a?.address||'';
export const autoReply=(m:Message)=>m.email?.auto_reply===true||m.email?.kind==='auto_reply';
const notice=(m:Message)=>m.email?.kind==='bounce'||m.email?.kind==='unreadable';
const outgoing=(m:Message)=>m.kind==='outbound'||m.direction==='outbound';
/** Cards are e-mails. Events, auto-replies, bounces and unreadable mail are centered timeline lines. */
export function isEmailCard(m:Message){return (m.kind==='message'||m.kind==='outbound'||m.kind==='automatic'||m.kind==='comment')&&!autoReply(m)&&!notice(m)}
export function emailSender(m:Message,c:Pick<Conversation,'contact_name'|'recipient'>,operator?:string){if(m.email?.from)return addressName(m.email.from);return outgoing(m)?(m.author||operator||''):(c.contact_name||c.recipient)}
export function emailEventText(m:Message,c:Pick<Conversation,'contact_name'|'recipient'>){const name=m.email?.from?addressName(m.email.from):c.contact_name||c.recipient;const text=emailSnippet(m.body,120);if(autoReply(m))return t('email.autoReplyEvent',{name,text});if(m.email?.kind==='bounce')return t('email.bounceEvent',{text});if(m.email?.kind==='unreadable')return t('email.unreadableEvent',{name});return serverEventText(m,name)??m.body}
/** Inbox events of the e-mail channel arrive as data (event, form, answers, campaign), without text. */
export const SERVER_EMAIL_EVENTS=['form_opened','form_submitted','campaign_email_started','email_unsubscribed'];
export function serverEventText(m:Message,name:string):string|null{if(m.kind!=='event'||!m.event||!SERVER_EMAIL_EVENTS.includes(m.event))return null;const form=m.form?.name||'';
 if(m.event==='form_opened')return t('email.formOpenedEvent',{name,form});
 if(m.event==='form_submitted'){const answers=(m.answers||[]).filter(a=>a.label&&a.value).map(a=>a.label+': '+emailSnippet(a.value,80)).join(' · ');return t('email.formSubmittedEvent',{name,form,answers:answers?' · '+answers:''})}
 if(m.event==='campaign_email_started')return t('email.campaignStartedEvent',{campaign:m.campaign?.name||''});
 return t('email.unsubscribedEvent',{name})}
/** The e-mail thread shows the channel's own server events, which the chat projection hides for having no text. */
export function emailTimelineMessages(messages:Message[],c:Pick<Conversation,'contact_name'|'recipient'>):Message[]{return messages.map(m=>m.kind==='event'&&!m.body?.trim()&&m.event&&SERVER_EMAIL_EVENTS.includes(m.event)?{...m,body:serverEventText(m,c.contact_name||c.recipient)||''}:m)}
export type EmailRow={type:'card';key:string;message:Message;open:boolean}|{type:'event';key:string;message:Message;text:string}|{type:'note';key:string;message:Message}|{type:'group';key:string;count:number};
/**
 * Gmail-style rows: the latest e-mail and the unread ones start open, the rest collapsed. A run of
 * more than four collapsed e-mails (events in between included) becomes one "N earlier messages" row.
 * `toggled` holds the cards the operator opened or closed; `groups` the summary rows already expanded.
 */
export function emailThreadRows(messages:Message[],c:Pick<Conversation,'contact_name'|'recipient'|'unread'>,toggled:Record<string,boolean>={},groups:Set<string>=new Set()):EmailRow[]{
 const cards=messages.filter(isEmailCard);const last=cards.at(-1);
 const pending=Math.max(0,c.unread||0);const inbound=cards.filter(m=>!outgoing(m));const unread=new Set((pending?inbound.slice(-pending):[]).map(messageKey));
 const rows:EmailRow[]=messages.map(m=>{const key=messageKey(m);if(isEmailCard(m))return {type:'card',key,message:m,open:toggled[key]??(m===last||unread.has(key))};if(m.kind==='note')return {type:'note',key,message:m};return {type:'event',key,message:m,text:emailEventText(m,c)}});
 const out:EmailRow[]=[];let i=0;
 while(i<rows.length){
  const row=rows[i];
  if(row.type!=='card'||row.open){out.push(row);i++;continue}
  // Run from this collapsed card up to the last collapsed card before the next open card.
  let end=i,j=i,count=0;while(j<rows.length){const r=rows[j];if(r.type==='card'){if(r.open)break;count++;end=j}j++}
  const key='group:'+row.key;
  if(count>4&&!groups.has(key)){out.push({type:'group',key,count});i=end+1}else{out.push(...rows.slice(i,end+1));i=end+1}
 }
 return out;
}
export type ImageKind='attachment'|'remote'|null;
/** Proxy images (attachments, cid:) load with the session; remote https images wait for "Show images"; nothing else loads. */
export function emailImageKind(src:string|undefined,account:Pick<Account,'origin'|'config'>|null|undefined,attachments:Attachment[]=[]):ImageKind{
 if(!src)return null;if(attachments.some(a=>a.uri&&a.uri===src))return 'attachment';
 const relative=src.startsWith('/')&&!src.startsWith('//');
 let url:URL;try{url=new URL(src,account?.origin)}catch{return null}
 if(url.protocol!=='https:'||url.username||url.password)return null;
 if(account){try{const own=new URL(account.origin).origin===url.origin;const base=account.config?.api_base?new URL(account.config.api_base).pathname:'/inbox/mobile/api';if(own&&attachments.some(a=>a.uri&&new URL(a.uri,account.origin).href===url.href))return 'attachment';if(own&&(url.pathname.startsWith(base+'/email/')||url.pathname.startsWith('/s/inbox/api/email/'))&&/\/email\/[1-9][0-9]*\/attachments\/(?:0|[1-9][0-9]*)$/.test(url.pathname))return 'attachment'}catch{}}
 return relative?null:'remote';
}
const imagePattern=/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
export function bodyImages(body:string){return [...body.matchAll(imagePattern)].map(m=>m[1])}
export function hasRemoteImages(body:string,account:Pick<Account,'origin'|'config'>|null|undefined,attachments:Attachment[]=[]){return bodyImages(body).some(src=>emailImageKind(src,account,attachments)==='remote')}
/** Inline images already shown in the body are not repeated as attachment chips. */
export function attachmentChips(m:Message){const list=m.attachments||(m.attachment?[m.attachment]:[]);const inline=new Set(bodyImages(m.body));return list.filter(a=>!a.uri||!inline.has(a.uri))}
export function originalAvailable(m:Message){return m.email?.has_original===true&&/^[1-9][0-9]*$/.test(String(m.id))}
/** The system browser has no Bearer header: the server signs a five-minute link to its own origin. */
export function checkedOriginalUrl(value:unknown,account:Pick<Account,'origin'>){
 let url:URL;try{if(typeof value!=='string')throw Error();url=new URL(value)}catch{throw new ApiError(502,'invalid_original_link',t('email.originalUnavailable'))}
 if(url.protocol!=='https:'||url.username||url.password||url.origin!==new URL(account.origin).origin)throw new ApiError(502,'invalid_original_link',t('email.originalUnavailable'));
 return url.toString();
}
export async function originalLink(api:Transport,account:Pick<Account,'origin'>,messageId:number|string){
 if(!/^[1-9][0-9]*$/.test(String(messageId)))throw new ApiError(422,'invalid_message',t('email.originalUnavailable'));
 const result=await api.request<{url?:unknown;expires_at?:unknown}>({method:'POST',path:`/inbox/mobile/messages/${messageId}/original-link`});
 return checkedOriginalUrl(result?.url,account);
}
export type InboxForm={id:number;name:string};
export function formsFromApi(raw:unknown):InboxForm[]{const items:unknown[]=Array.isArray(raw)?raw:Array.isArray((raw as {items?:unknown})?.items)?(raw as {items:unknown[]}).items:[];return items.flatMap(x=>{const f=x as {id?:unknown;name?:unknown};return Number.isSafeInteger(f?.id)&&Number(f.id)>0&&typeof f.name==='string'&&f.name.trim()?[{id:Number(f.id),name:f.name.trim()}]:[]})}
export const formMarker=(id:number)=>`[[form:${id}]]`;
/** Inserts the survey marker that the server expands into the contact's signed link. */
export function withFormMarker(draft:string,id:number){const marker=formMarker(id);const next=draft.trim()?draft.replace(/\s+$/,'')+'\n\n'+marker:marker;if(next.length>EMAIL_BODY_MAX)throw Error('form_too_long');return next}
/** Subject is required only for the first e-mail of a conversation; otherwise the server falls back to "Re: …". */
export function composeError(body:string,subject:string,previousSubject:string){if(!body.trim())return t('email.bodyRequired');if(body.length>EMAIL_BODY_MAX)return t('email.bodyTooLong');if(!subject.trim()&&!previousSubject.trim())return t('email.subjectRequired');if(subject.trim().length>EMAIL_SUBJECT_MAX)return t('email.subjectTooLong');return null}
