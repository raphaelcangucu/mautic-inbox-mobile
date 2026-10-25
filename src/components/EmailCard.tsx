import React,{useEffect,useState} from 'react';
import {View,Image} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import {t,formatTime,formatDay,formatDateTime} from '../i18n/engine';
import {canRetryMessage} from '../api/message-retry';
import {HttpTransport} from '../api/http';
import {addressLabel,addressName,attachmentChips,emailImageKind,emailSender,emailSnippet,hasRemoteImages,originalAvailable,originalLink} from '../api/email';
import type {Attachment,Conversation,EmailAddress,Message} from '../api/types';
import {useApp} from '../store/app';
import {useTheme} from '../theme';
import {T,Tap,Icon,Avatar} from './ui';
import {Media,demoMedia} from './Media';
import {MessageBody} from './MessageBody';

const sameDay=(value:string)=>new Date(value).toDateString()===new Date().toDateString();
const shortDate=(value:string)=>sameDay(value)?formatTime(value):formatDay(value);

/** Proxy (cid:/attachment) images load with the session; remote images only after "Show images". */
function EmailImage({src,alt,attachments,showRemote}:{src:string;alt:string;attachments:Attachment[];showRemote:boolean}){
 const c=useTheme();const account=useApp(st=>st.active);const transport=useApp(st=>st.transport);
 const kind=emailImageKind(src,account,attachments);const attachment=attachments.find(a=>a.uri===src);
 const [source,setSource]=useState<any>(null);const [failed,setFailed]=useState(false);
 useEffect(()=>{let alive=true;setSource(null);setFailed(false);
  if(kind==='attachment'){if(account?.mode==='mock'&&attachment?.demoKey)setSource(demoMedia[attachment.demoKey]);else if(transport instanceof HttpTransport)void transport.mediaSource(src).then(value=>{if(alive)setSource(value)}).catch(()=>{if(alive)setFailed(true)});else setFailed(true)}
  else if(kind==='remote'&&showRemote)setSource({uri:src});
  return()=>{alive=false}},[src,kind,showRemote,account?.id]);
 if(!kind||failed||!source)return <View testID="email-image-placeholder" style={{flexDirection:'row',gap:6,alignItems:'center',padding:8,borderRadius:8,backgroundColor:c.canvas}}><Icon name="file" size={14} color={c.soft}/><T size={12} muted numberOfLines={2} style={{flex:1}}>{kind==='remote'&&!showRemote?t('email.imageBlocked',{alt:alt||t('email.image')}):alt||t('email.image')}</T></View>;
 return <Image testID="email-inline-image" accessibilityLabel={alt||t('email.image')} source={source} onError={()=>setFailed(true)} resizeMode="contain" style={{width:'100%',height:190,borderRadius:8,backgroundColor:c.canvas}}/>;
}

function Recipients({label,list}:{label:string;list:EmailAddress[]}){if(!list.length)return null;return <View style={{flexDirection:'row',gap:6}}><T size={11} muted style={{width:44}}>{label}</T><T size={11} style={{flex:1}} selectable>{list.map(addressLabel).join(', ')}</T></View>}

export function EmailCard({message:m,conversation,open,onToggle,onActions,favorite=false,onRetry,onCheck,retryBusy=false,retryDisabled=false}:{message:Message;conversation:Conversation;open:boolean;onToggle:()=>void;onActions:()=>void;favorite?:boolean;onRetry:()=>void;onCheck:()=>void;retryBusy?:boolean;retryDisabled?:boolean}){
 const c=useTheme();const account=useApp(st=>st.active);const transport=useApp(st=>st.transport);const notify=useApp(st=>st.notify);
 const [details,setDetails]=useState(false);const [quoted,setQuoted]=useState(false);const [images,setImages]=useState(false);const [originalBusy,setOriginalBusy]=useState(false);
 const id=String(m.display_id??m.id);const out=m.kind==='outbound'||m.direction==='outbound';
 const sender=emailSender(m,conversation,account?.user.name);
 const from:EmailAddress|null=m.email?.from||(out?(conversation.asset.address?{name:[m.author||account?.user.name,conversation.asset.name].filter(Boolean).join(' · '),address:conversation.asset.address}:null):{name:conversation.contact_name,address:conversation.recipient});
 const to:EmailAddress[]=m.email?.to?.length?m.email.to:out?[{name:conversation.contact_name,address:conversation.recipient}]:conversation.asset.address?[{name:conversation.asset.name,address:conversation.asset.address}]:[];
 const cc=m.email?.cc||[];
 const attachments=m.attachments||(m.attachment?[m.attachment]:[]);const chips=attachmentChips(m);
 const remote=hasRemoteImages(m.body,account,attachments)||hasRemoteImages(m.email?.quoted||'',account,attachments);
 const attention=m.status==='failed'||m.status==='uncertain';
 const status:Record<string,string>={sending:t('receipt.sending'),pending:t('receipt.pending'),sent:t('receipt.sent'),accepted:t('receipt.sent'),delivered:t('receipt.delivered'),read:t('receipt.read'),uncertain:t('receipt.uncertain'),failed:t('receipt.failed')};
 const image=(src:string,alt:string,key:number)=><EmailImage key={key} src={src} alt={alt} attachments={attachments} showRemote={images}/>;
 async function original(){
  if(!account||originalBusy)return;setOriginalBusy(true);
  // createTask:false opens the tab in the app's own task. In its own task (the default), Android
  // brings back any tab left there, such as an abandoned browser login, instead of this link.
  try{const api=useApp.getState().repo?.api;if(!api)throw Error(t('email.originalUnavailable'));const url=await originalLink(api,account,m.id);await WebBrowser.openBrowserAsync(url,{createTask:false})}
  catch(e){notify(e instanceof Error?e.message:t('email.originalUnavailable'))}finally{setOriginalBusy(false)}
 }
 const headerLabel=t(open?'email.collapseCard':'email.openCard',{name:sender});
 return <View testID={'email-card-'+id} style={{backgroundColor:c.paper,borderRadius:14,borderWidth:1,borderColor:open?c.line:c.paper,marginBottom:8,overflow:'hidden'}}>
  <Tap testID={'email-card-header-'+id} label={headerLabel} onPress={onToggle} style={{flexDirection:'row',alignItems:'flex-start',gap:10,paddingHorizontal:12,paddingVertical:10}}>
   {out?<View style={{width:34,height:34,borderRadius:12,backgroundColor:c.blue,alignItems:'center',justifyContent:'center'}}><T bold size={12} color={c.paper}>{sender.slice(0,2).toUpperCase()}</T></View>:<Avatar conversation={conversation} size={34} showChannel={false}/>}
   <View style={{flex:1,minWidth:0}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:6}}><T bold size={14} numberOfLines={1} style={{flex:1,lineHeight:20}}>{sender}</T>{favorite&&<Icon name="star" size={12} color={c.blue}/>}{!open&&attachments.length>0&&<Icon name="attach" size={13} color={c.soft}/>}<T size={11} color={attention?c.warn:c.faint} style={{lineHeight:16}}>{shortDate(m.timestamp)}</T></View>
    {open?<T size={11} muted numberOfLines={1} style={{lineHeight:16}}>{t('email.toLine',{names:to.map(addressName).join(', ')||'—'})}</T>:<T testID={'email-card-snippet-'+id} size={12} muted numberOfLines={1} style={{lineHeight:18}}>{emailSnippet(m.body)||chips.map(a=>a.name).join(', ')||t('message.noText')}</T>}
   </View>
  </Tap>
  {open&&<View testID={'email-card-open-'+id} style={{paddingHorizontal:12,paddingBottom:10,gap:8}}>
   <Tap testID={'email-details-toggle-'+id} label={details?t('email.hideDetails'):t('email.showDetails')} onPress={()=>setDetails(!details)} style={{minHeight:30,flexDirection:'row',gap:4,justifyContent:'flex-start'}}><T size={11} color={c.blue}>{details?t('email.hideDetails'):t('email.showDetails')}</T><Icon name={details?'up':'chevron-down'} size={12} color={c.blue}/></Tap>
   {details&&<View testID={'email-details-'+id} style={{gap:4,padding:8,borderRadius:10,backgroundColor:c.canvas}}><Recipients label={t('email.fromField')} list={from?[from]:[]}/><Recipients label={t('email.toField')} list={to}/><Recipients label={t('email.ccField')} list={cc}/>{!!m.subject&&<View style={{flexDirection:'row',gap:6}}><T size={11} muted style={{width:44}}>{t('email.subjectField')}</T><T size={11} style={{flex:1}}>{m.subject}</T></View>}<View style={{flexDirection:'row',gap:6}}><T size={11} muted style={{width:44}}>{t('email.dateField')}</T><T size={11} style={{flex:1}}>{formatDateTime(m.timestamp)}</T></View></View>}
   {m.email?.unverified_sender&&<View testID={'email-unverified-'+id} style={{flexDirection:'row',gap:8,padding:8,borderRadius:10,backgroundColor:c.warnBg}}><Icon name="shield" size={16} color={c.warn}/><T size={11} color={c.warn} style={{flex:1,lineHeight:16}}>{t('email.unverified')}</T></View>}
   {!!m.body.trim()&&<MessageBody testID={'email-body-'+id} body={m.body} channel="email" renderImage={image}/>}
   {remote&&!images&&<Tap testID={'email-show-images-'+id} label={t('email.showImages')} onPress={()=>setImages(true)} style={{minHeight:36,flexDirection:'row',gap:6,justifyContent:'flex-start',paddingHorizontal:10,borderRadius:10,backgroundColor:c.canvas}}><Icon name="lock" size={14} color={c.soft}/><T size={11} muted style={{flex:1,lineHeight:16}}>{t('email.imagesBlocked')}</T><T size={11} bold color={c.blue}>{t('email.showImages')}</T></Tap>}
   {!!m.email?.quoted&&<Tap testID={'email-quoted-toggle-'+id} label={quoted?t('email.hideQuoted'):t('email.showQuoted')} onPress={()=>setQuoted(!quoted)} style={{alignSelf:'flex-start',minHeight:30,minWidth:44,paddingHorizontal:10,borderRadius:8,backgroundColor:c.canvas,alignItems:'center'}}><T bold size={14} color={c.soft} style={{lineHeight:16}}>•••</T></Tap>}
   {quoted&&!!m.email?.quoted&&<View testID={'email-quoted-'+id} style={{borderLeftWidth:2,borderColor:c.line,paddingLeft:8}}><MessageBody testID={'email-quoted-body-'+id} body={m.email.quoted} channel="email" renderImage={image}/></View>}
   {chips.length>0&&<View testID={'email-attachments-'+id} style={{gap:6}}><T size={11} muted>{t('email.attachments',{count:chips.length})}</T>{chips.map((a,index)=>a.available===false||!a.uri?<View key={index} testID={'email-attachment-unavailable-'+id+'-'+index} style={{flexDirection:'row',gap:8,alignItems:'center',padding:10,borderRadius:10,borderWidth:1,borderColor:c.line}}><Icon name="attach" size={16} color={c.faint}/><View style={{flex:1}}><T size={12} bold numberOfLines={1}>{a.name}</T><T size={11} muted>{t('email.attachmentUnavailable')}</T></View></View>:<View key={index} testID={'email-attachment-'+id+'-'+index} style={{paddingHorizontal:10,paddingBottom:8,borderRadius:10,borderWidth:1,borderColor:c.line}}><Media attachment={a}/></View>)}</View>}
   {out&&m.status&&<T testID={'email-status-'+id} size={11} color={attention?c.warn:c.faint}>{status[m.status]||m.status}</T>}
   {attention&&m.failure&&<T size={11} color={c.warn} style={{lineHeight:16}}>{m.failure}</T>}
   {canRetryMessage(m)&&<Tap testID={'retry-message-'+m.id} label={retryBusy?t('chat.retryBusy'):m.status==='uncertain'?t('chat.retryUncertain'):t('chat.retrySend')} disabled={retryBusy||retryDisabled} onPress={onRetry} style={{minHeight:40,flexDirection:'row',justifyContent:'flex-start',gap:6}}><Icon name="refresh" size={14} color={c.blue}/><T size={12} bold color={c.blue}>{retryBusy?t('chat.retryBusy'):m.status==='uncertain'?t('chat.retryUncertain'):t('chat.retrySend')}</T></Tap>}
   {attention&&!canRetryMessage(m)&&<Tap label={t('chat.checkSend')} onPress={onCheck} style={{minHeight:40,alignItems:'flex-start'}}><T size={12} bold color={c.blue}>{t('chat.checkHistory')}</T></Tap>}
   <View style={{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:6}}>
    {originalAvailable(m)&&<Tap testID={'email-original-'+id} label={t('email.original')} disabled={originalBusy||!transport} onPress={()=>void original()} style={{minHeight:36,paddingHorizontal:10,flexDirection:'row',gap:6,borderRadius:10,borderWidth:1,borderColor:c.line}}><Icon name="open-outline" size={14} color={c.blue}/><T size={11} color={c.blue}>{originalBusy?t('email.originalOpening'):t('email.original')}</T></Tap>}
    <Tap testID={'message-actions-'+m.kind+'-'+m.id} label={t('message.actionsAt',{time:formatTime(m.timestamp)})} onPress={onActions} style={{width:40,minHeight:36,alignItems:'center'}}><Icon name="more" size={20} color={c.soft} strokeWidth={2.6}/></Tap>
   </View>
  </View>}
 </View>;
}
