import {canRetryMessage} from '../api/message-retry';
import {formatTime,formatDay} from '../i18n/engine';
import {t} from '../i18n/engine';
import React from 'react';
import {View} from 'react-native';
import type {Message} from '../api/types';
import {useTheme} from '../theme';
import {T,Tap,Icon} from './ui';
import {Media} from './Media';
import {MessageBody} from './MessageBody';
import {groupChatMessages,sameChatDay} from './chat-timeline';


export function ChatMessage({message:m,previous,comment,whatsapp=false,onEmail,onCheck,onRetry,onReport,retryBusy=false,retryDisabled=false}:{message:Message;previous?:Message;comment:boolean;whatsapp?:boolean;onEmail:(email:string)=>void;onCheck:()=>void;onRetry:()=>void;onReport:()=>void;retryBusy?:boolean;retryDisabled?:boolean}){
 const statusLabel:Record<string,string>={sending:t('receipt.sending'),pending:t('receipt.pending'),sent:t('receipt.sent'),accepted:t('receipt.sent'),delivered:t('receipt.delivered'),read:t('receipt.read'),uncertain:t('receipt.uncertain'),failed:t('receipt.failed')};
 const c=useTheme();const note=m.kind==='note';const out=m.kind==='outbound'||m.direction==='outbound';
 const grouped=groupChatMessages(previous,m);const day=!previous||!sameChatDay(previous,m);
 const time=formatTime(m.timestamp);
 const email=m.body.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
 const attention=m.status==='failed'||m.status==='uncertain';
 const statusIcon=m.status==='sending'||m.status==='pending'?'clock':attention?'refresh':m.status==='read'||m.status==='delivered'?'checks':'check';
 return <View testID={'timeline-'+m.kind+'-'+m.id} style={{paddingTop:grouped?2:8}}>
  {day&&<View style={{alignItems:'center',paddingTop:4,paddingBottom:8}}><T muted size={10} style={{lineHeight:14}}>{formatDay(m.timestamp)}</T></View>}
  {m.kind==='event'?<T size={10} muted style={{textAlign:'center',lineHeight:14,paddingHorizontal:16,paddingVertical:3}}>{m.body}</T>:<View style={{alignSelf:note?'stretch':out?'flex-end':'flex-start',maxWidth:note?'100%':'86%',backgroundColor:note?c.warnBg:out?c.tint:c.paper,borderColor:note?c.warn:c.line,borderWidth:out?0:1,borderRadius:14,borderBottomLeftRadius:out?14:4,borderBottomRightRadius:out?4:14,paddingHorizontal:10,paddingVertical:7}}>
   {note&&<T bold size={10} color={c.warn} style={{lineHeight:14,marginBottom:3}}>{t("chat.internalTeam")}</T>}
   {m.ai&&<T bold size={10} color={c.blue} style={{lineHeight:14,marginBottom:3}}>{m.ai} · {t('filter.ai')}</T>}
   {m.kind==='comment'&&<T size={10} color={c.blue} style={{lineHeight:14,marginBottom:3}}>{t("chat.publicComment")}</T>}
   {comment&&m.replyMode&&<T size={10} color={c.blue} style={{lineHeight:14,marginBottom:3}}>{m.replyMode==='private'?t("chat.privateReply"):t("chat.publicReply")}</T>}
   {!!m.body&&<MessageBody body={m.body} whatsapp={whatsapp} onEmail={onEmail}/>}
   {email&&<Tap label={t("chat.saveEmail")} onPress={()=>onEmail(email)} style={{minHeight:44}}><T size={11} bold color={c.blue}>{t("chat.saveEmail")}</T></Tap>}
   {m.attachment&&<Media attachment={m.attachment}/>}
   <View accessible accessibilityLabel={time+(out&&m.status?', '+statusLabel[m.status]:'')} style={{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:4,marginTop:3}}>
    <T size={10} color={attention?c.warn:c.faint} style={{lineHeight:12}}>{time}{attention?' · '+statusLabel[m.status!]:''}</T>
    {out&&!note&&m.status&&<Icon name={statusIcon} size={14} color={attention?c.warn:m.status==='read'?c.blue:c.faint} strokeWidth={1.6}/>}
   </View>
   {!!m.attempt_count&&m.attempt_count>1&&<T size={10} muted style={{lineHeight:14,marginTop:3}}>{t('chat.retryAttempts',{count:m.attempt_count})}</T>}
   {attention&&m.failure&&<T size={11} color={c.warn} style={{lineHeight:16,marginTop:6}}>{m.failure}</T>}
   {canRetryMessage(m)&&<Tap testID={'retry-message-'+m.id} label={retryBusy?t('chat.retryBusy'):m.status==='uncertain'?t('chat.retryUncertain'):t('chat.retrySend')} disabled={retryBusy||retryDisabled} onPress={onRetry} style={{minHeight:44,flexDirection:'row',justifyContent:'flex-start',gap:6}}><Icon name="refresh" size={14} color={c.blue}/><T size={12} bold color={c.blue}>{retryBusy?t('chat.retryBusy'):m.status==='uncertain'?t('chat.retryUncertain'):t('chat.retrySend')}</T></Tap>}
   {attention&&<Tap label={t('chat.reportFailure')} onPress={onReport} style={{minHeight:36}}><T size={11} color={c.soft}>{t('chat.reportFailure')}</T></Tap>}
   {attention&&!canRetryMessage(m)&&<Tap label={t("chat.checkSend")} onPress={onCheck} style={{minHeight:44}}><T size={12} bold color={c.blue}>{t("chat.checkHistory")}</T></Tap>}
  </View>}
 </View>;
}
