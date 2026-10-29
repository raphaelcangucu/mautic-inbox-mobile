import React,{useEffect,useMemo,useRef,useState} from 'react';
import {View,ScrollView,Keyboard,Animated,BackHandler,Alert,Platform,Share} from 'react-native';
import {t,formatDateTime} from '../i18n/engine';
import {emailThreadRows,emailTimelineMessages,threadSubject,isEmailCard} from '../api/email';
import {conversationConnection} from '../api/conversation-connection';
import {replyAccess} from '../api/reply-mode';
import {deliveryReport} from '../api/delivery-diagnostics';
import {favoriteIdentity,type MessageFavorite} from '../api/message-favorites';
import {channels,messageKey,type Message} from '../api/types';
import {visibleChatMessages} from '../components/chat-timeline';
import {EmailCard} from '../components/EmailCard';
import {MessageActions} from '../components/MessageActions';
import {ConversationActions,type Panel,SnoozeChips} from '../components/ConversationActions';
import {Sheet} from '../components/Sheet';
import {T,Tap,Icon,Button} from '../components/ui';
import {useSwipeBack} from '../hooks/useSwipeBack';
import {useApp} from '../store/app';
import {useTheme} from '../theme';
import {EmailCompose} from './EmailCompose';

/** Gmail-style thread for `conversation.channel === 'email'`: subject on top, stacked cards, Reply/Forward at the end. */
export function EmailThread(){
 const c=useTheme();const s=useApp();const conversation=s.conversations.find(x=>x.id===s.conversationId)!;
 const messages=s.messages[s.conversationId]||[];const visible=useMemo(()=>visibleChatMessages(emailTimelineMessages(messages,conversation)),[messages,conversation.contact_name,conversation.recipient]);
 // Unread cards start open; keep that choice after the conversation is marked read.
 const [unreadAtOpen]=useState(conversation.unread);
 const [toggled,setToggled]=useState<Record<string,boolean>>({});const [groups,setGroups]=useState<Set<string>>(new Set());
 const rows=useMemo(()=>emailThreadRows(visible,{...conversation,unread:unreadAtOpen},toggled,groups),[visible,unreadAtOpen,toggled,groups,conversation.contact_name,conversation.recipient]);
 const subject=threadSubject(conversation,visible);const connection=conversationConnection(conversation);
 const [compose,setCompose]=useState<'reply'|'note'|null>(null);const [menu,setMenu]=useState(false);const [context,setContext]=useState(false);const [panel,setPanel]=useState<Panel>(null);
 const [actionMessage,setActionMessage]=useState<Message|null>(null);const [forwardRequest,setForwardRequest]=useState<{message:Message;nonce:number}|null>(null);
 const [favorites,setFavorites]=useState<MessageFavorite[]>([]);const [retrying,setRetrying]=useState<string|null>(null);
 const scroll=useRef<ScrollView>(null);const positioned=useRef(false);const nearEnd=useRef(true);const pending=useRef<(()=>void)|null>(null);
 const favoriteIds=useMemo(()=>new Set(favorites.flatMap(record=>[record.identity,record.messageKey])),[favorites]);
 const access=replyAccess(conversation,'private',s.active?.user.id||0,s.active?.mode==='live');
 const cards=visible.filter(isEmailCard);
 const backToInbox=()=>{Keyboard.dismiss();if(s.view.kind!=='inbox')s.setView({kind:'inbox',listOffset:0,railOffset:0});s.navigate('inbox')};
 const swipe=useSwipeBack(backToInbox,!compose&&!menu&&!context&&!panel&&!actionMessage);
 useEffect(()=>{let alive=true;const repo=s.repo,id=s.conversationId;if(repo)void repo.messageFavorites(id).then(records=>{if(alive)setFavorites(records)}).catch(()=>{});return()=>{alive=false}},[s.repo,s.conversationId]);
 // Opening the thread reads it, as reaching the last bubble does in the chat.
 useEffect(()=>{if(cards.length)void useApp.getState().read()},[cards.length]);
 useEffect(()=>{if(nearEnd.current)requestAnimationFrame(()=>scroll.current?.scrollToEnd({animated:positioned.current}))},[visible.length]);
 // Hardware back closes the composition first; the draft stays saved.
 useEffect(()=>{if(!compose)return;const sub=BackHandler.addEventListener('hardwareBackPress',()=>{setCompose(null);return true});return()=>sub.remove()},[compose]);
 function toggle(key:string,open:boolean){setToggled(value=>({...value,[key]:!open}))}
 async function favoriteMessage(){const repo=s.repo,message=actionMessage,id=s.conversationId;if(!repo||!message)return;const saved=await repo.toggleMessageFavorite(id,message);const records=await repo.messageFavorites(id);if(useApp.getState().repo!==repo||useApp.getState().conversationId!==id)return;setFavorites(records);s.notify(t(saved?'message.favorited':'message.unfavorited'))}
 async function retry(message:Message){if(retrying)return;setRetrying(messageKey(message));try{await s.retryMessage(message)}finally{setRetrying(null)}}
 async function openCompose(mode:'reply'|'note'){Keyboard.dismiss();await s.setMode(mode);setCompose(mode)}
 const take=()=>{const run=()=>void s.transition('take');if(conversation.assignee&&conversation.assignee.id!==s.active?.user.id)Alert.alert(t('chat.takeTitle'),t('chat.takeBody',{name:conversation.assignee.name}),[{text:t('common.cancel'),style:'cancel'},{text:t('chat.take'),onPress:run}]);else run()};
 const choose=(action:()=>void)=>{if(Platform.OS==='ios'){pending.current=action;setMenu(false)}else{setMenu(false);action()}};
 const quickAction=(label:string,icon:string,onPress:()=>void,options:{testID?:string;disabled?:boolean;ok?:boolean}={})=><Tap key={label} label={label} testID={options.testID} disabled={options.disabled} onPress={()=>choose(onPress)} style={{flex:1,minHeight:76,height:76,borderRadius:14,backgroundColor:options.ok?c.okBg:c.tintSofter,alignItems:'center',justifyContent:'center',gap:7}}><Icon name={icon} size={22} strokeWidth={2} color={options.ok?c.ok:c.blue}/><T size={13} heavy numberOfLines={1} color={options.ok?c.okText:c.blue}>{label}</T></Tap>;
 const row=(label:string,icon:string,onPress:()=>void,testID?:string,disabled=false)=><Tap key={label} label={label} testID={testID} disabled={disabled} onPress={()=>choose(onPress)} style={{minHeight:46,flexDirection:'row',gap:12,justifyContent:'flex-start',paddingVertical:8}}><Icon name={icon} size={20} color={c.soft}/><T size={14} style={{flex:1,lineHeight:20}}>{label}</T></Tap>;
 // The thread remounts after the composition closes: show its end again, where Reply is.
 if(compose)return <EmailCompose conversation={conversation} mode={compose} previousSubject={subject} onClose={()=>{positioned.current=false;setCompose(null)}} onSent={()=>{positioned.current=false;nearEnd.current=true;setCompose(null);void useApp.getState().setMode('reply')}}/>;
 const owner=conversation.assignee?.id===s.active?.user.id?t('chat.withYou'):conversation.assignee?.name||t('filter.unassigned');
 const delayed=conversation.email?.inbound==='delayed';
 return <Animated.View style={[{flex:1},swipe.style]}>
  <View testID="email-thread-header" style={{paddingHorizontal:8,paddingTop:6,paddingBottom:12,backgroundColor:c.paper,borderBottomWidth:1,borderColor:c.divider,gap:10}}>
   <View style={{flexDirection:'row',alignItems:'center',gap:2}}>
    <Tap label={t('chat.backInbox')} testID="email-thread-back" onPress={backToInbox} style={{width:40,minHeight:44,alignItems:'center'}}><Icon name="chevron-back" size={22}/></Tap>
    <View style={{flex:1}}/>
    <Tap label={conversation.lifecycle==='resolved'?t('chat.reopen'):t('chat.resolve')} testID="email-resolve" disabled={s.offline} onPress={()=>void s.transition(conversation.lifecycle==='resolved'?'reopen':'resolve')} style={{width:44,minHeight:44,alignItems:'center'}}><Icon name={conversation.lifecycle==='resolved'?'refresh':'check'} size={22} color={c.blue}/></Tap>
    <Tap label={t('email.reply')} testID="email-header-reply" disabled={s.offline} onPress={()=>void openCompose('reply')} style={{width:44,minHeight:44,alignItems:'center'}}><Icon name="mail" size={22} color={c.blue}/></Tap>
    <Tap label={t('chat.actions')} testID="chat-actions" onPress={()=>{Keyboard.dismiss();setMenu(true)}} style={{width:44,minHeight:44,alignItems:'center'}}><Icon name="more" size={22} strokeWidth={2.6}/></Tap>
   </View>
   <View style={{paddingHorizontal:10,gap:8}}>
    <T testID="email-thread-subject" heavy size={22} line={28} numberOfLines={3}>{subject||t('email.noSubject')}</T>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,alignItems:'center'}}>
     <View testID="email-thread-account" style={{paddingHorizontal:10,paddingVertical:4,borderRadius:8,backgroundColor:c.warnBg}}><T size={13} heavy color={c.warnText}>{channels.email}</T></View>
     <Tap testID="chat-context" label={t('chat.details')} onPress={()=>setContext(true)} style={{flex:1,minHeight:28,alignItems:'flex-start'}}><T size={14} muted numberOfLines={1}>{connection.label} · {owner}</T></Tap>
    </View>
   </View>
  </View>
  {delayed&&<View testID="email-inbound-delayed" style={{flexDirection:'row',gap:8,paddingHorizontal:16,paddingVertical:7,backgroundColor:c.canvas,borderBottomWidth:1,borderColor:c.line}}><Icon name="clock" size={14} color={c.soft}/><T size={11} muted style={{flex:1,lineHeight:16}}>{conversation.email?.inbound_since?t('email.delayedSince',{time:formatDateTime(conversation.email.inbound_since)}):t('email.delayed')}</T></View>}
  {(access.reason||s.offline)&&<View testID="reply-blocked-reason" style={{paddingHorizontal:16,paddingVertical:7,backgroundColor:c.warnBg}}><T size={11} color={c.warn}>{s.offline?t('inbox.offline'):access.reason}</T></View>}
  {access.take&&<Button quiet label={t('chat.takeReply')} testID="take-to-reply" disabled={s.offline} onPress={take}/>}
  {conversation.lifecycle==='resolved'&&<Button quiet label={t('chat.reopenReply')} disabled={s.offline} onPress={()=>void s.transition('reopen')}/>}
  <View ref={swipe.area} collapsable={false} onLayout={swipe.measure} {...swipe.panHandlers} style={{flex:1}}>
   <ScrollView ref={scroll} testID="email-thread" style={{flex:1,backgroundColor:c.canvas}} contentContainerStyle={{padding:10,paddingBottom:16}} keyboardShouldPersistTaps="handled" scrollEventThrottle={160} onScroll={e=>{const n=e.nativeEvent;nearEnd.current=n.contentOffset.y+n.layoutMeasurement.height>=n.contentSize.height-120}} onContentSizeChange={()=>{if(!positioned.current&&rows.length){positioned.current=true;scroll.current?.scrollToEnd({animated:false})}}}>
    {s.cursor&&<Tap testID="email-older" label={t('chat.older')} onPress={()=>void s.older()} style={{alignItems:'center',minHeight:40}}><T size={12} color={c.blue}>{t('chat.older')}</T></Tap>}
    {!rows.length&&<View testID="email-thread-empty" style={{padding:24,alignItems:'center',gap:8}}><Icon name="mail" size={28} color={c.faint}/><T size={13} muted style={{textAlign:'center'}}>{s.messages[s.conversationId]?t('email.empty'):t('chat.loadingHistory')}</T></View>}
    {rows.map(r=>r.type==='group'?<Tap key={r.key} testID="email-earlier-messages" label={t('email.earlier',{count:r.count})} onPress={()=>setGroups(value=>new Set([...value,r.key]))} style={{flexDirection:'row',alignItems:'center',gap:10,minHeight:44,marginBottom:8}}><View style={{flex:1,height:1,backgroundColor:c.line}}/><View style={{minWidth:30,height:30,borderRadius:15,borderWidth:1,borderColor:c.line,backgroundColor:c.paper,alignItems:'center',justifyContent:'center',paddingHorizontal:6}}><T bold size={12} color={c.soft}>{r.count}</T></View><T size={12} color={c.blue}>{t('email.earlier',{count:r.count})}</T><View style={{flex:1,height:1,backgroundColor:c.line}}/></Tap>
     :r.type==='event'?<T key={r.key} testID={'timeline-event-'+r.message.id} size={11} muted style={{textAlign:'center',lineHeight:16,paddingHorizontal:20,paddingVertical:6}}>{r.text}</T>
     :r.type==='note'?<Tap key={r.key} testID={'email-note-'+r.message.id} label={t('chat.internalTeam')} onPress={()=>setActionMessage(r.message)} style={{backgroundColor:c.warnBg,borderColor:c.warn,borderWidth:1,borderRadius:12,padding:10,marginBottom:8,alignItems:'stretch'}}><T bold size={10} color={c.warn}>{t('chat.internalTeam')}{r.message.author?' · '+r.message.author:''}</T><T size={13} style={{lineHeight:19}}>{r.message.body}</T></Tap>
     :<EmailCard key={r.key} message={r.message} conversation={conversation} open={r.open} onToggle={()=>toggle(r.key,r.open)} onActions={()=>setActionMessage(r.message)} favorite={favoriteIds.has(favoriteIdentity(r.message))||favoriteIds.has(messageKey(r.message))} onRetry={()=>void retry(r.message)} onCheck={()=>void s.sync()} retryBusy={retrying===messageKey(r.message)} retryDisabled={s.offline||!!retrying}/>)}
   </ScrollView>
  </View>
  {s.toast&&<View pointerEvents="none" testID="chat-feedback" style={{paddingHorizontal:16,paddingVertical:6,backgroundColor:c.tint}}><T size={11} color={c.blue}>{s.toast}</T></View>}
  <View testID="email-thread-actions" style={{flexDirection:'row',gap:8,padding:10,backgroundColor:c.paper,borderTopWidth:1,borderColor:c.line}}>
   <Tap testID="email-reply" label={t('email.reply')} disabled={s.offline} onPress={()=>void openCompose('reply')} style={{flex:1,minHeight:52,flexDirection:'row',gap:10,borderRadius:26,borderWidth:1,borderColor:c.lineBlue,backgroundColor:c.paper}}><Icon name="reply" size={20} color={c.blue}/><T heavy size={16} color={c.blue}>{t('email.reply')}</T></Tap>
   <Tap testID="email-forward" label={t('email.forward')} disabled={!cards.some(m=>m.body.trim())} onPress={()=>{const last=[...cards].reverse().find(m=>m.body.trim());if(last)setForwardRequest({message:last,nonce:Date.now()})}} style={{flex:1,minHeight:52,flexDirection:'row',gap:10,borderRadius:26,borderWidth:1,borderColor:c.lineBlue,backgroundColor:c.paper}}><Icon name="forward" size={20} color={c.blue}/><T heavy size={16} color={c.blue}>{t('email.forward')}</T></Tap>
  </View>
  <MessageActions message={actionMessage} favorite={!!actionMessage&&(favoriteIds.has(favoriteIdentity(actionMessage))||favoriteIds.has(messageKey(actionMessage)))} onClose={()=>setActionMessage(null)} onFavorite={favoriteMessage} forwardRequest={forwardRequest}/>
  <Sheet title={t('chat.details')} visible={context} onClose={()=>setContext(false)}><T bold size={17}>{conversation.contact_name}</T><T size={13} selectable>{conversation.recipient}</T><T size={13} muted>{t('email.accountLine',{account:connection.label})}</T><T size={13}>{conversation.assignee?t('chat.assignee')+' '+conversation.assignee.name:t('filter.unassigned')}</T><Button quiet testID="open-contact" label={t('chat.contactHistory')} onPress={()=>{setContext(false);s.navigate('contact')}}/></Sheet>
  <Sheet title={t('chat.actions')} visible={menu} onClose={()=>setMenu(false)} onDismiss={()=>{const run=pending.current;pending.current=null;run?.()}}>
   <View style={{flexDirection:'row',gap:8,paddingBottom:4}}>
    {quickAction(conversation.lifecycle==='resolved'?t('chat.reopen'):t('inbox.swipeResolve'),'check',()=>void s.transition(conversation.lifecycle==='resolved'?'reopen':'resolve'),{ok:true,disabled:s.offline,testID:'quick-resolve'})}
    {quickAction(t('chat.snoozeShort'),'clock',()=>setPanel('snooze'),{testID:'quick-snooze'})}
    {quickAction(t('chat.transferShort'),'arrow-up',()=>setPanel('transfer'),{testID:'quick-transfer'})}
    {quickAction(t('chat.take'),'person-outline',take,{testID:'quick-take',disabled:s.offline||(s.active?.mode==='live'&&!access.take)})}
   </View>
   <SnoozeChips disabled={s.offline} onChoose={()=>setPanel('snooze')}/>
   <View>
    {row(t('email.reply'),'reply',()=>void openCompose('reply'),'menu-email-reply')}
    {row(t('chat.note'),'lock-closed-outline',()=>void openCompose('note'),'menu-email-note')}
    {row(t('chat.historyContact'),'person-outline',()=>s.navigate('contact'))}
   </View>
   <View style={{borderTopWidth:1,borderColor:c.line,paddingTop:4}}>
    {row(t('chat.takeAction'),'person-outline',take,'take',s.offline||(s.active?.mode==='live'&&!access.take))}
    {row(conversation.lifecycle==='resolved'?t('chat.reopen'):t('chat.resolve'),'check',()=>void s.transition(conversation.lifecycle==='resolved'?'reopen':'resolve'),undefined,s.offline)}
    {row(t('chat.transfer'),'arrow-up',()=>setPanel('transfer'),'open-transfer')}
    {row(t('chat.snooze'),'clock',()=>setPanel('snooze'),'open-snooze')}
    {row(t('chat.updateContact'),'person-outline',()=>setPanel('crm'))}
    {s.active?.mode==='mock'&&row(t('chat.simulate'),'refresh',()=>void s.inject(),'simulate-email')}
    {cards.some(m=>m.status==='failed'||m.status==='uncertain')&&row(t('chat.reportFailure'),'share',()=>{const failed=cards.find(m=>m.status==='failed'||m.status==='uncertain')!;void Share.share({message:deliveryReport(conversation.id,conversation.asset.id,failed)})})}
   </View>
  </Sheet>
  <ConversationActions panel={panel} onClose={()=>setPanel(null)}/>
 </Animated.View>;
}
