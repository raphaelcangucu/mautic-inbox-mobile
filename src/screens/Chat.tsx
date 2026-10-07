import {deliveryReport} from '../api/delivery-diagnostics';
import {t} from '../i18n/engine';
import {replyAccess} from '../api/reply-mode';
import {OverlayModal} from '../components/OverlayModal';
import {ConversationActions,type Panel} from '../components/ConversationActions';
import {Sheet} from '../components/Sheet';
import {WhatsQrConnections} from '../components/WhatsQrConnections';
import {inspectQrConnection,qrConversation,qrNeedsRecovery,pairingLabel,type QrPairing} from '../api/whatsqr';
import {publicationURL,openPublication} from '../api/publication';
import {Media} from '../components/Media';
import {ChatMessage} from '../components/ChatMessage';
import {visibleChatMessages} from '../components/chat-timeline';
import {useSwipeBack} from '../hooks/useSwipeBack';
import {Linking,Alert,AppState,Share} from 'react-native';
import React,{useEffect,useRef,useState,useMemo} from 'react';
import {View,FlatList,TextInput,ScrollView,Keyboard,Animated} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {useAudioRecorder,RecordingPresets,AudioModule,useAudioRecorderState} from 'expo-audio';
import {useApp} from '../store/app';
import {useTheme,font} from '../theme';
import {T,Tap,Icon,Avatar,Button,Field,Card} from '../components/ui';
import {channels,messageKey,type Message,type Template} from '../api/types';
export function Chat(){
 const [qrRequest,setQrRequest]=useState(0);const [qrState,setQrState]=useState<QrPairing|null>(null);const qrProbe=useRef(0);
 const c=useTheme();const s=useApp();const conversation=s.conversations.find(x=>x.id===s.conversationId);const list=useRef<FlatList<Message>>(null);const atEnd=useRef(true);const restoring=useRef(true);const messages=s.messages[s.conversationId]||[];const visibleMessages=useMemo(()=>visibleChatMessages(messages),[messages]);const reversed=useMemo(()=>[...visibleMessages].reverse(),[visibleMessages]);const [menu,setMenu]=useState(false);const [contextSheet,setContextSheet]=useState(false);const [panel,setPanel]=useState<Panel>(null);const [email,setEmail]=useState('');const [templates,setTemplates]=useState<Template[]>([]);const [templateSheet,setTemplateSheet]=useState(false);const [templateReason,setTemplateReason]=useState('');const [selected,setSelected]=useState<Template|null>(null);const [variables,setVariables]=useState<Record<string,string>>({});const [attachmentSheet,setAttachmentSheet]=useState(false);
 const [retrying,setRetrying]=useState<string|null>(null);
 const [postSheet,setPostSheet]=useState(false);const [postBusy,setPostBusy]=useState(false);const [postError,setPostError]=useState('');
 const recorder=useAudioRecorder(RecordingPresets.HIGH_QUALITY);const recording=useAudioRecorderState(recorder);
 const backToInbox=()=>{Keyboard.dismiss();const kind=conversation?.kind==='comments'?'comments':'inbox';if(s.view.kind!==kind)s.setView({kind,listOffset:0,railOffset:0});s.navigate('inbox')};
 const swipe=useSwipeBack(backToInbox,!menu&&!contextSheet&&!panel&&!templateSheet&&!attachmentSheet&&!postSheet&&!recording.isRecording);
 useEffect(()=>{restoring.current=true;atEnd.current=true;const timer=setTimeout(()=>{const offset=s.view.chatOffsets[s.conversationId];if(offset!==undefined){list.current?.scrollToOffset({offset,animated:false});atEnd.current=false}else list.current?.scrollToOffset({offset:0,animated:false});restoring.current=false},150);return()=>clearTimeout(timer)},[s.conversationId]);
 useEffect(()=>{if(!restoring.current&&atEnd.current){requestAnimationFrame(()=>list.current?.scrollToOffset({offset:0,animated:true}));useApp.setState({unseen:0})}},[visibleMessages.length]);
 const viewability=useRef(({viewableItems}:{viewableItems:any[]})=>{const st=useApp.getState();const data=visibleChatMessages(st.messages[st.conversationId]||[]);const last=data.at(-1);if(last&&viewableItems.some(x=>messageKey(x.item)===messageKey(last))){void st.read()}const first=viewableItems[0]?.item;if(first)st.setView({chatAnchors:{...st.view.chatAnchors,[st.conversationId]:messageKey(first)}})}).current;
 const qr=!!conversation&&qrConversation(conversation)&&s.active?.mode==='live';
 async function checkQr(recover=false){
  if(!qr||!conversation||!s.repo||s.offline)return;
  const sequence=++qrProbe.current;const id=conversation.id;const account=s.active?.id;const repo=s.repo;
  const fresh=await inspectQrConnection(repo.api,conversation.asset.id);const current=useApp.getState();
  if(sequence!==qrProbe.current||current.active?.id!==account||current.repo!==repo||current.route!=='chat'||current.conversationId!==id)return;
  setQrState(fresh);if(recover&&fresh&&qrNeedsRecovery(fresh)){Keyboard.dismiss();setQrRequest(value=>value+1)}
 }
 useEffect(()=>{
  if(!qr||!s.repo)return;const probe=()=>{if(AppState.currentState==='active')void checkQr()};probe();const timer=setInterval(probe,15000);const listener=AppState.addEventListener('change',state=>{if(state==='active')probe()});
  return()=>{qrProbe.current++;clearInterval(timer);listener.remove()};
 },[qr,s.repo,conversation?.asset.id,s.active?.id]);
 if(!conversation)return <View style={{padding:24}}><T>{t("chat.unavailable")}</T><Button label={t("common.back")} onPress={s.back}/></View>;
 async function sendReply(template?:Template,variables?:Record<string,string>){
  if(qr&&s.mode==='reply'&&qrState&&qrNeedsRecovery(qrState)){Keyboard.dismiss();setQrRequest(value=>value+1);return false}
  const accepted=await s.send(template,variables);if(qr&&s.mode==='reply')await checkQr(true);return accepted;
 }
 async function publication(){Keyboard.dismiss();setPostSheet(true);setPostError('');if(s.active?.mode!=='live'||!s.repo||postBusy)return;setPostBusy(true);try{const origins=await s.repo.api.request<{items:any[]}>({method:'GET',path:`/inbox/api/conversations/${conversation!.id}/publication`,query:{refresh:1}});const source=origins.items[0];if(source&&useApp.getState().active?.id===s.active?.id&&useApp.getState().conversationId===conversation!.id){const current=useApp.getState().conversations.find(x=>x.id===conversation!.id);if(!current)return;const updated={...current,comment:{...current.comment!,postTitle:source.title||current.comment?.postTitle||t("chat.publication"),postBody:source.caption||'',commentBody:source.body||current.comment?.commentBody||'',permalink:source.permalink||'',image:source.image||null}};await s.repo.saveConversations([updated]);useApp.setState({conversations:useApp.getState().conversations.map(x=>x.id===updated.id?updated:x)})}}catch{setPostError(t("chat.postRefreshError"))}finally{setPostBusy(false)}}
 async function externalPost(){const result=await openPublication(conversation?.comment?.permalink,conversation!.channel,url=>Linking.openURL(url));if(result!=='opened')setPostError(result==='missing'?t("chat.postMissing"):t("chat.postOpenError"))}
 const comment=conversation.kind==='comments';const access=replyAccess(conversation,s.replyMode,s.active?.user.id||0,s.active?.mode==='live');const {reply,blocked}=access;
 const take=()=>{const run=()=>void s.transition('take');if(conversation.assignee&&conversation.assignee.id!==s.active?.user.id){Alert.alert(t("chat.takeTitle"),t('chat.takeBody',{name:conversation.assignee.name}),[{text:t("common.cancel"),style:'cancel'},{text:t("chat.take"),onPress:run}]);}else run();};
 const cta=async()=>{if(s.offline){s.notify(t("chat.templatesOffline"));return}try{const data=await s.repo!.api.request<{items:Template[];blocked_reason:string|null}>({method:'GET',path:`/inbox/api/conversations/${conversation.id}/templates`});setTemplates(data.items);setTemplateReason(data.blocked_reason||'');setSelected(null);setTemplateSheet(true)}catch(e){s.notify(String(e))}};
 async function document(){const result=await DocumentPicker.getDocumentAsync({copyToCacheDirectory:true});if(!result.canceled){const a=result.assets[0];useApp.setState({attachment:{name:a.name,uri:a.uri,mime:a.mimeType||'application/octet-stream',size:a.size}});setAttachmentSheet(false)}}
 async function image(){const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:.6});if(!result.canceled){const a=result.assets[0];useApp.setState({attachment:{name:a.fileName||'imagem.jpg',uri:a.uri,mime:a.mimeType||'image/jpeg',size:a.fileSize}});setAttachmentSheet(false)}}
 async function voice(){try{if(recording.isRecording){await recorder.stop();useApp.setState({attachment:{name:t("chat.voiceFilename"),uri:recorder.uri||undefined,mime:'audio/mp4',duration:recording.durationMillis}});return}const permission=await AudioModule.requestRecordingPermissionsAsync();if(!permission.granted){s.notify(t("chat.allowMic"));return}await recorder.prepareToRecordAsync();recorder.record()}catch(e){s.notify(t("chat.recordError"))}}
 const suggest=()=>{if(s.active?.mode==='live')s.navigate('assistant');else{s.setDraft(t("chat.demoSuggestion"));s.notify(t("chat.draftSuggested"))}};
 const choose=(action:()=>void)=>{setMenu(false);action()};
 const actionRow=(label:string,icon:string,onPress:()=>void,options:{testID?:string;selected?:boolean;disabled?:boolean}={})=><Tap key={label} label={label} testID={options.testID} disabled={options.disabled} onPress={()=>choose(onPress)} style={{minHeight:46,flexDirection:'row',gap:12,justifyContent:'flex-start',paddingVertical:8}}><Icon name={icon} size={20} color={options.selected?c.blue:c.soft}/><T size={14} bold={options.selected} style={{flex:1,lineHeight:20}}>{label}</T>{options.selected&&<Icon name="check" size={18} color={c.blue}/>}</Tap>;
 async function retryMessage(message:Message){
  if(retrying)return;setRetrying(messageKey(message));
  try{await s.retryMessage(message);if(qr)await checkQr(true)}finally{setRetrying(null)}
 }
 const render=({item,index}:{item:Message;index:number})=><ChatMessage message={item} previous={reversed[index+1]} comment={comment} whatsapp={conversation.channel==='whatsapp'} onEmail={value=>{setEmail(value);setPanel('crm')}} onCheck={()=>{void s.sync();void checkQr(true)}} onReport={()=>void Share.share({message:deliveryReport(conversation.id,conversation.asset.id,item)})} onRetry={()=>void retryMessage(item)} retryBusy={retrying===messageKey(item)} retryDisabled={s.offline||!!retrying}/>;
 return <Animated.View style={[{flex:1},swipe.style]}><View testID="compact-chat-header" style={{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:8,paddingVertical:6,backgroundColor:c.paper,borderBottomWidth:1,borderColor:c.line}}>
 <Tap label={t("chat.backInbox")} onPress={backToInbox} style={{width:36,minHeight:44,alignItems:'center'}}><Icon name="chevron-back" size={21}/></Tap>
 <Avatar conversation={conversation} size={34} showChannel={false}/>
 <Tap label={t("chat.details")} testID="chat-context" onPress={()=>{Keyboard.dismiss();setContextSheet(true)}} style={{flex:1,minHeight:44}}><T bold size={16} numberOfLines={1} style={{lineHeight:21}}>{conversation.contact_name}</T><T size={11} muted numberOfLines={1} style={{lineHeight:16}}>{comment?t("chat.commentPrefix")+" ":''}{channels[conversation.channel]} · {conversation.assignee?.id===s.active?.user.id?t("chat.withYou"):conversation.mobile.ai?t("common.aiAgent"):conversation.assignee?.name||t("filter.unassigned")}</T></Tap>
 {comment&&<Tap label={t("chat.viewPost")} testID="open-publication" onPress={()=>void publication()} style={{width:44,minHeight:44,alignItems:'center'}}><Icon name="megaphone-outline" size={21} color={c.blue}/></Tap>}
 </View>
 {(access.reason||s.offline)&&s.mode==='reply'&&<View testID="reply-blocked-reason" style={{paddingHorizontal:18,paddingVertical:8,backgroundColor:c.warnBg}}><T size={11} color={c.warn}>{s.offline?t("inbox.offline"):access.reason}</T></View>}
 {access.take&&s.mode==='reply'&&<Button quiet label={t("chat.takeReply")} testID="take-to-reply" disabled={s.offline} onPress={take}/>}
 {conversation.lifecycle==='resolved'&&s.mode==='reply'&&<Button quiet label={t("chat.reopenReply")} disabled={s.offline} onPress={()=>void s.transition('reopen')}/>}
 {qr&&qrState&&qrNeedsRecovery(qrState)&&s.mode==='reply'&&<Tap testID="chat-qr-recovery" label={t("qr.manageConnection")} onPress={()=>{Keyboard.dismiss();setQrRequest(value=>value+1)}} style={{paddingHorizontal:16,paddingVertical:8,backgroundColor:c.warnBg,flexDirection:'row',gap:8,justifyContent:'flex-start'}}><T size={11} color={c.warn} style={{flex:1,lineHeight:16}}>{pairingLabel(qrState)}</T><T size={11} bold color={c.blue} style={{lineHeight:16}}>{t("qr.manageConnection")}</T></Tap>}
 {comment&&(conversation.moderation?.spam||conversation.moderation?.blockedAuthor||conversation.moderation?.hidden)&&<View style={{paddingHorizontal:12,paddingVertical:6,backgroundColor:c.warnBg}}><T size={11} color={c.warn} style={{lineHeight:16}}>{conversation.moderation.blockedAuthor?t("chat.blocked"):conversation.moderation.spam?t("chat.spam"):(s.active?.mode==='mock'?t("chat.hiddenDemo"):t("chat.hiddenInstagram"))}</T></View>}
 <View ref={swipe.area} collapsable={false} onLayout={swipe.measure} {...swipe.panHandlers} testID="chat-swipe-back-area" style={{flex:1}}><FlatList ref={list} data={reversed} inverted renderItem={render} keyExtractor={item=>item.kind+':'+(item.display_id??item.id)} style={{flex:1}} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingHorizontal:12,paddingVertical:8}} maintainVisibleContentPosition={{minIndexForVisible:0}} onViewableItemsChanged={viewability} viewabilityConfig={{itemVisiblePercentThreshold:40}} onScroll={e=>{const event=e.nativeEvent;atEnd.current=event.contentOffset.y<80;if(!restoring.current)s.setView({chatOffsets:{...s.view.chatOffsets,[s.conversationId]:event.contentOffset.y}})}} scrollEventThrottle={160} onContentSizeChange={()=>{if(restoring.current&&s.view.chatOffsets[s.conversationId]===undefined)list.current?.scrollToOffset({offset:0,animated:false})}} ListFooterComponent={s.cursor?<Tap label={t("chat.older")} onPress={()=>void s.older()} style={{alignItems:'center',minHeight:44}}><T size={12} color={c.blue}>{t("chat.older")}</T></Tap>:null} ListEmptyComponent={<T muted>{t("chat.loadingHistory")}</T>}/></View>
 {s.unseen>0&&!atEnd.current&&<Button label={t("chat.newMessages",{count:s.unseen})} onPress={()=>{list.current?.scrollToOffset({offset:0,animated:true});useApp.setState({unseen:0});atEnd.current=true}}/>}
 {s.toast&&<View pointerEvents="none" testID="chat-feedback" style={{paddingHorizontal:16,paddingVertical:6,backgroundColor:c.tint}}><T size={11} color={c.blue}>{s.toast}</T></View>}
 <View testID="compact-chat-composer" style={{backgroundColor:c.paper,paddingHorizontal:8,paddingVertical:8,borderTopWidth:1,borderColor:c.line,gap:6}}>
 {s.attachment&&<View style={{flexDirection:'row',gap:8,alignItems:'center',paddingHorizontal:8}}><T size={12} style={{flex:1}}>{s.attachment.name} {t("chat.mockUpload")}</T><Tap label={t("chat.removeAttachment")} onPress={()=>useApp.setState({attachment:null})}><Icon name="close" size={16}/></Tap></View>}
 <View style={{flexDirection:'row',gap:6,alignItems:'flex-end'}}>
 <Tap label={t("chat.actions")} testID="chat-actions" onPress={()=>{Keyboard.dismiss();setMenu(true)}} style={{width:44,height:44,borderRadius:14,backgroundColor:c.canvas,alignItems:'center'}}><Icon name="plus" size={22} color={c.blue}/></Tap>
 <View style={{flex:1,backgroundColor:s.mode==='note'?c.warnBg:s.theme==='dark'?c.raised:c.canvas,borderRadius:15}}>
 {(s.mode==='note'||comment)&&<Tap label={t("chat.changeMode")} onPress={()=>{Keyboard.dismiss();setMenu(true)}} style={{minHeight:28,paddingHorizontal:10,flexDirection:'row',gap:5,justifyContent:'flex-start'}}><Icon name={s.mode==='note'?'lock-closed-outline':s.replyMode==='public'?'globe-outline':'lock-closed-outline'} size={12} color={s.mode==='note'?c.warn:c.blue}/><T size={10} bold color={s.mode==='note'?c.warn:c.blue} style={{lineHeight:14}}>{s.mode==='note'?t("chat.internalTeam"):s.replyMode==='public'?t("chat.publicReply"):t("chat.privateReply")}</T><Icon name="chevron-down" size={12} color={c.soft}/></Tap>}
 <TextInput accessibilityLabel={t("chat.message")} testID="composer" placeholder={s.mode==='note'?t("chat.teamPlaceholder"):t("chat.messagePlaceholder")} placeholderTextColor={c.faint} value={s.draft} onChangeText={s.setDraft} multiline maxLength={4000} style={{minHeight:44,maxHeight:120,paddingHorizontal:10,paddingVertical:10,includeFontPadding:false,fontSize:15,lineHeight:21,fontFamily:font.regular,color:c.ink,textAlignVertical:'top'}}/>
 </View>
 <Tap label={s.draft.trim()||s.attachment?(comment&&s.mode==='reply'?(s.replyMode==='public'?t("chat.sendPublic"):t("chat.sendPrivate")):s.mode==='note'?t("chat.saveNote"):t("chat.send")):recording.isRecording?t("chat.finishRecording"):conversation.mobile.attachments?t("chat.record"):t("chat.send")} testID="send" disabled={s.offline||(s.mode==='reply'&&(blocked||!reply.available))} onPress={()=>{if(s.draft.trim()||s.attachment){atEnd.current=true;void sendReply();}else if(conversation.mobile.attachments)void voice();else s.notify(t("chat.writeHint"))}} style={{width:44,height:44,borderRadius:14,backgroundColor:recording.isRecording?c.warn:c.blue,alignItems:'center'}}><Icon name={s.draft.trim()||s.attachment?'arrow-up':recording.isRecording?'stop':conversation.mobile.attachments?'mic-outline':'arrow-up'} color={c.paper}/></Tap>
 </View>{recording.isRecording&&<T size={11} color={c.warn}>{t("chat.recording",{seconds:Math.round(recording.durationMillis/1000)})}</T>}
 </View>
 {qr&&<WhatsQrConnections assetId={conversation.asset.id} request={qrRequest} hideTrigger onConnected={()=>{void s.sync();void checkQr()}}/>}
 <Sheet title={t("chat.details")} visible={contextSheet} onClose={()=>setContextSheet(false)}><T bold size={17}>{conversation.contact_name}</T><T size={13} muted>{channels[conversation.channel]} · {conversation.asset.name}</T>{conversation.origins.campaign&&conversation.origins.campaign!==conversation.asset.name&&<T size={13}>{t("actions.campaignLabel",{name:conversation.origins.campaign})}</T>}{conversation.origins.page&&<T size={12} muted>{conversation.origins.page}</T>}<T size={13}>{conversation.assignee?(t("chat.assignee")+" "+conversation.assignee.name):t("filter.unassigned")}</T><Button quiet label={t("chat.contactHistory")} onPress={()=>{setContextSheet(false);s.navigate('contact')}}/>{comment&&<Button quiet label={t("chat.viewOriginal")} onPress={()=>{setContextSheet(false);void publication()}}/>}</Sheet>
 <Sheet title={t("chat.actions")} visible={menu} onClose={()=>setMenu(false)}>
 <View>
 {qr&&actionRow(t("qr.manageConnection"),'refresh',()=>setQrRequest(value=>value+1),{testID:'chat-open-qr-connection'})}
 {actionRow(t("chat.suggest"),'sparkles-outline',suggest)}
 {actionRow(t("chat.canned"),'chatbubbles-outline',()=>setPanel('canned'),{testID:'open-canned'})}
 {conversation.channel==='whatsapp'&&actionRow(t("chat.whatsappTemplates"),'document-text-outline',()=>void cta(),{testID:'templates'})}
 {actionRow(t("chat.historyContact"),'person-outline',()=>s.navigate('contact'))}
 {comment&&actionRow(t("chat.originalPost"),'megaphone-outline',()=>void publication())}
 </View>
 <View style={{borderTopWidth:1,borderColor:c.line,paddingTop:4}}>
 {actionRow(t("chat.reply"),'chatbubbles-outline',()=>void s.setMode('reply'),{selected:s.mode==='reply'})}
 {actionRow(t("chat.note"),'lock-closed-outline',()=>void s.setMode('note'),{selected:s.mode==='note'})}
 {comment&&actionRow(t("chat.publicReply"),'globe-outline',()=>{void s.setMode('reply');useApp.setState({replyMode:'public'})},{testID:'reply-public',selected:s.mode==='reply'&&s.replyMode==='public',disabled:conversation.comment?.canPublic===false})}
 {comment&&actionRow(t("chat.privateReply"),'lock-closed-outline',()=>{void s.setMode('reply');useApp.setState({replyMode:'private'})},{testID:'reply-private',selected:s.mode==='reply'&&s.replyMode==='private',disabled:!conversation.comment?.canPrivate})}
 {conversation.mobile.attachments&&actionRow(t("chat.attach"),'attach',()=>setAttachmentSheet(true))}
 </View>
 <View style={{borderTopWidth:1,borderColor:c.line,paddingTop:4}}>
 {actionRow(t("chat.takeAction"),'person-outline',take,{testID:'take',disabled:s.offline||(s.active?.mode==='live'&&!access.take)})}
 {actionRow(conversation.lifecycle==='resolved'?t("chat.reopen"):t("chat.resolve"),'check',()=>void s.transition(conversation.lifecycle==='resolved'?'reopen':'resolve'),{disabled:s.offline})}
 {actionRow(t("chat.transfer"),'arrow-up',()=>setPanel('transfer'),{testID:'open-transfer'})}
 {actionRow(t("chat.snooze"),'clock',()=>setPanel('snooze'),{testID:'open-snooze'})}
 {actionRow(t("chat.agent"),'sparkles-outline',()=>setPanel('agent'),{testID:'open-agent'})}
 {actionRow(t("chat.updateContact"),'person-outline',()=>{setEmail('');setPanel('crm')})}
 {comment&&actionRow(t("chat.moderate"),'shield-checkmark-outline',()=>setPanel('moderation'),{testID:'open-moderation'})}
 {comment&&conversation.comment?.relatedId&&actionRow(t("chat.openPrivate"),'chatbubbles-outline',()=>void s.openChat(conversation.comment!.relatedId!),{testID:'open-related'})}
 {s.active?.mode==='mock'&&actionRow(t("chat.simulate"),'refresh',()=>void s.inject())}

 </View>
 </Sheet>
 <Sheet title={t("chat.originalPost")} visible={postSheet} onClose={()=>setPostSheet(false)}><T bold>{conversation.comment?.postBody?t("chat.postFrom")+" "+channels[conversation.channel]:(conversation.comment?.postTitle||t("chat.publication"))}</T>{conversation.comment?.image&&<Media attachment={{name:t("chat.postImage"),mime:'image/jpeg',uri:conversation.comment.image}}/>}<T size={13}>{conversation.comment?.postBody||t("chat.postDescriptionMissing")}</T>{conversation.comment?.commentBody&&<Card><T size={11} bold color={c.blue}>{t("chat.receivedComment")}</T><T size={13}>{conversation.comment.commentBody}</T></Card>}{postBusy&&<T muted size={12}>{t("chat.loadingPost")}</T>}{!postBusy&&!publicationURL(conversation.comment?.permalink,conversation.channel)&&<T size={12} muted>{t("chat.postLinkMissing")}</T>}{publicationURL(conversation.comment?.permalink,conversation.channel)&&<Button label={t("chat.openOn")+" "+channels[conversation.channel]} onPress={()=>void externalPost()}/>}{postError&&<T size={12} color={c.warn} accessibilityRole="alert">{postError}</T>}{s.active?.mode==='live'&&<Button quiet label={t("chat.refreshPost")} disabled={postBusy||s.offline} onPress={()=>void publication()}/>}</Sheet>
 <ConversationActions panel={panel} email={email} onClose={()=>setPanel(null)}/>
 <Sheet title={t("chat.attachTitle")} visible={attachmentSheet} onClose={()=>setAttachmentSheet(false)}><Button label={t("chat.document")} onPress={()=>void document()}/><Button quiet label={t("chat.image")} onPress={()=>void image()}/><T size={12} muted>{t("chat.mockMediaHint")}</T></Sheet>
 <OverlayModal visible={templateSheet} onClose={()=>setTemplateSheet(false)}><View style={{flex:1,justifyContent:'flex-end'}}><Tap label={t("chat.closeTemplates")} onPress={()=>setTemplateSheet(false)} style={{flex:1}}><View/></Tap><View style={{maxHeight:'85%',backgroundColor:c.paper,padding:24,paddingBottom:40,borderTopLeftRadius:24,borderTopRightRadius:24}}><ScrollView contentContainerStyle={{gap:14}}><T bold size={22}>{selected?t("chat.templatePreview"):t("chat.reactivate")}</T><T size={12} muted>{s.active?.mode==='mock'?t("chat.templatesMock"):t("chat.templatesApproved")} · {s.active?.name} · {conversation.contact_name}</T>{!selected&&!templates.length&&<T size={13} muted>{templateReason||t("chat.noTemplates")}</T>}{selected?<><Card><T size={12} color={c.blue}>{selected.name} · {selected.language}</T><T>{selected.preview.replace(/\{\{(\w+)\}\}/g,(_,token)=>variables['BODY:'+token]||'{{'+token+'}}')}</T></Card>{selected.fields.map(field=><Field key={field.key} label={field.token==='1'?t("chat.contactName"):t("chat.subject")} value={variables[field.key]||''} onChange={value=>setVariables({...variables,[field.key]:value})}/>)}<T size={12} muted>{t("chat.templateHint")}</T><Button label={s.active?.mode==='mock'?t("chat.sendTemplateMock"):t("chat.sendTemplate")} disabled={selected.fields.some(f=>!variables[f.key]?.trim())||s.offline} onPress={()=>{void s.send(selected,variables).then(ok=>{if(ok)setTemplateSheet(false)})}}/><Button quiet label={t("chat.otherTemplate")} onPress={()=>setSelected(null)}/></>:templates.map(template=><Tap key={template.id} disabled={!template.supported} label={template.name} onPress={()=>{setSelected(template);setVariables({'BODY:1':conversation.contact_name.split(' ')[0],'BODY:2':t("chat.report")})}}><Card><T bold>{template.name}</T><T size={11} color={c.blue}>{template.category} · {template.language} · {s.active?.mode==='mock'?t("chat.approvedMock"):t("chat.approved")}</T><T size={13} muted>{template.preview}</T>{!template.supported&&<T size={11} color={c.warn}>{t("chat.formatUnsupported")}</T>}</Card></Tap>)}</ScrollView></View></View></OverlayModal>
 </Animated.View>;
}
