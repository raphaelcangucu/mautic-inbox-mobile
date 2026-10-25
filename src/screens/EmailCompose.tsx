import React,{useEffect,useRef,useState} from 'react';
import {View,ScrollView,TextInput,Platform,Keyboard} from 'react-native';
import {t} from '../i18n/engine';
import {composeError,formsFromApi,replySubject,withFormMarker,EMAIL_BODY_MAX,EMAIL_SUBJECT_MAX,type InboxForm} from '../api/email';
import {conversationConnection} from '../api/conversation-connection';
import {replyAccess} from '../api/reply-mode';
import type {Conversation} from '../api/types';
import {useApp} from '../store/app';
import {useTheme,font} from '../theme';
import {T,Tap,Icon,Card} from '../components/ui';
import {Sheet} from '../components/Sheet';
import {ConversationActions,type Panel} from '../components/ConversationActions';

/** Reply composition: To (the lead, fixed), From (the account), editable "Re:" subject and the body draft kept as today. */
export function EmailCompose({conversation,mode,previousSubject,onClose,onSent}:{conversation:Conversation;mode:'reply'|'note';previousSubject:string;onClose:()=>void;onSent:()=>void}){
 const c=useTheme();const s=useApp();const note=mode==='note';
 const subjectKey='draft:'+conversation.id+':subject';
 const [subject,setSubject]=useState(replySubject(previousSubject));const [plus,setPlus]=useState(false);const [panel,setPanel]=useState<Panel>(null);
 const [formsOpen,setFormsOpen]=useState(false);const [forms,setForms]=useState<InboxForm[]>([]);const [formsBusy,setFormsBusy]=useState(false);const [formsError,setFormsError]=useState('');
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);const pending=useRef<(()=>void)|null>(null);
 const connection=conversationConnection(conversation);
 const access=replyAccess(conversation,'private',s.active?.user.id||0,s.active?.mode==='live');
 // Subject draft survives leaving the screen, like the body draft.
 useEffect(()=>{if(note)return;let alive=true;void s.repo?.disk.get<string>(subjectKey).then(saved=>{if(alive&&typeof saved==='string'&&saved.trim())setSubject(saved)}).catch(()=>{});return()=>{alive=false}},[conversation.id,note]);
 function changeSubject(value:string){setSubject(value);setError('');void s.repo?.disk.put(subjectKey,value).catch(()=>{})}
 function after(action:()=>void){if(Platform.OS==='ios'){pending.current=action;setPlus(false)}else{setPlus(false);action()}}
 async function loadForms(){setFormsOpen(true);setFormsBusy(true);setFormsError('');try{const cached=await s.repo?.disk.get<InboxForm[]>('feature:forms');if(cached)setForms(cached);if(s.offline||!s.repo){if(!cached)setFormsError(t('email.formsOffline'));return}const fresh=formsFromApi(await s.repo.api.request<unknown>({method:'GET',path:'/inbox/mobile/forms'}));await s.repo.disk.put('feature:forms',fresh);setForms(fresh)}catch(e){setFormsError(e instanceof Error?e.message:String(e))}finally{setFormsBusy(false)}}
 function insertForm(form:InboxForm){try{s.setDraft(withFormMarker(useApp.getState().draft,form.id));setFormsOpen(false);s.notify(t('email.formInserted',{name:form.name}))}catch{setFormsError(t('email.formTooLong'))}}
 async function send(){
  if(busy)return;const draft=useApp.getState().draft;
  const problem=note?(draft.trim()?null:t('email.bodyRequired')):composeError(draft,subject,previousSubject);
  if(problem){setError(problem);return}
  Keyboard.dismiss();setBusy(true);setError('');
  try{await s.send(undefined,undefined,note?undefined:subject);
   // The store clears the draft once the reply is registered locally (accepted, queued or failed with its receipt).
   if(!useApp.getState().draft.trim()){if(!note)await s.repo?.disk.remove(subjectKey).catch(()=>{});onSent()}
  }finally{setBusy(false)}
 }
 const blocked=!note&&access.blocked;
 const field=(label:string,value:string,testID:string)=><View testID={testID} style={{flexDirection:'row',alignItems:'center',gap:10,minHeight:44,borderBottomWidth:1,borderColor:c.line}}><T size={12} muted style={{width:56}}>{label}</T><T size={13} numberOfLines={2} style={{flex:1}} selectable>{value}</T></View>;
 return <View testID="email-compose" style={{flex:1,backgroundColor:c.paper}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:8,paddingVertical:6,borderBottomWidth:1,borderColor:c.line}}>
   <Tap testID="email-compose-close" label={t('email.closeCompose')} onPress={()=>{Keyboard.dismiss();onClose()}} style={{width:40,alignItems:'center'}}><Icon name="close" size={20}/></Tap>
   <T bold size={16} style={{flex:1}}>{note?t('chat.note'):previousSubject?t('email.replyTitle'):t('email.newTitle')}</T>
   {!note&&<Tap testID="email-compose-plus" label={t('email.insert')} onPress={()=>{Keyboard.dismiss();setPlus(true)}} style={{width:44,alignItems:'center'}}><Icon name="plus" size={21} color={c.blue}/></Tap>}
   <Tap testID="email-compose-send" label={note?t('chat.saveNote'):t('email.send')} disabled={busy||s.offline||blocked} onPress={()=>void send()} style={{minWidth:44,height:40,minHeight:40,paddingHorizontal:12,borderRadius:12,backgroundColor:note?c.warn:c.blue,flexDirection:'row',gap:6}}><Icon name={note?'lock':'send'} size={16} color={c.paper}/><T bold size={12} color={c.paper}>{note?t('email.save'):t('email.send')}</T></Tap>
  </View>
  {(blocked||s.offline)&&<View testID="reply-blocked-reason" style={{paddingHorizontal:16,paddingVertical:8,backgroundColor:c.warnBg}}><T size={11} color={c.warn}>{s.offline?t('inbox.offline'):access.reason}</T></View>}
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingHorizontal:16,paddingBottom:24}}>
   {note?<T size={11} color={c.warn} style={{paddingVertical:10}}>{t('email.noteHint')}</T>:<>
    {field(t('email.toField'),`${conversation.contact_name} <${conversation.recipient}>`,'email-compose-to')}
    {field(t('email.fromField'),[[s.active?.user.name,connection.name].filter(Boolean).join(' · '),connection.address?`<${connection.address}>`:''].filter(Boolean).join(' '),'email-compose-from')}
    <View style={{flexDirection:'row',alignItems:'center',gap:10,minHeight:48,borderBottomWidth:1,borderColor:c.line}}><T size={12} muted style={{width:56}}>{t('email.subjectField')}</T><TextInput testID="email-compose-subject" accessibilityLabel={t('email.subjectField')} value={subject} onChangeText={changeSubject} maxLength={EMAIL_SUBJECT_MAX} placeholder={previousSubject?replySubject(previousSubject):t('email.subjectPlaceholder')} placeholderTextColor={c.faint} style={{flex:1,minHeight:44,color:c.ink,fontFamily:font.bold,fontSize:14,includeFontPadding:false,paddingVertical:8}}/></View>
   </>}
   <TextInput testID="email-compose-body" accessibilityLabel={t('chat.message')} value={s.draft} onChangeText={value=>{setError('');s.setDraft(value)}} multiline maxLength={EMAIL_BODY_MAX} placeholder={note?t('chat.teamPlaceholder'):t('email.bodyPlaceholder')} placeholderTextColor={c.faint} textAlignVertical="top" style={{minHeight:220,color:c.ink,fontFamily:font.regular,fontSize:15,lineHeight:22,includeFontPadding:false,paddingVertical:12,...(note?{backgroundColor:c.warnBg,borderRadius:12,paddingHorizontal:10}:{})}}/>
   <T size={10} muted style={{textAlign:'right'}}>{s.draft.length}/{EMAIL_BODY_MAX}</T>
   {error&&<T testID="email-compose-error" size={12} color={c.warn} accessibilityRole="alert">{error}</T>}
   {s.toast&&<T testID="chat-feedback" size={11} color={c.blue}>{s.toast}</T>}
  </ScrollView>
  <Sheet title={t('email.insert')} visible={plus} onClose={()=>setPlus(false)} onDismiss={()=>{const run=pending.current;pending.current=null;run?.()}}>
   <Tap testID="email-compose-canned" label={t('chat.canned')} onPress={()=>after(()=>setPanel('canned'))} style={{minHeight:46,flexDirection:'row',gap:12,justifyContent:'flex-start'}}><Icon name="chatbubbles-outline" size={20} color={c.soft}/><T size={14} style={{flex:1}}>{t('chat.canned')}</T></Tap>
   <Tap testID="email-compose-form" label={t('email.form')} onPress={()=>after(()=>void loadForms())} style={{minHeight:46,flexDirection:'row',gap:12,justifyContent:'flex-start'}}><Icon name="document-text-outline" size={20} color={c.soft}/><T size={14} style={{flex:1}}>{t('email.form')}</T></Tap>
  </Sheet>
  <Sheet title={t('email.formsTitle')} visible={formsOpen} onClose={()=>setFormsOpen(false)}>
   <T size={12} muted>{t('email.formsHint')}</T>
   {forms.map(form=><Tap key={form.id} testID={'email-form-'+form.id} label={form.name} onPress={()=>insertForm(form)}><Card><T bold size={13}>{form.name}</T><T size={11} muted>{'[[form:'+form.id+']]'}</T></Card></Tap>)}
   {!forms.length&&!formsBusy&&!formsError&&<T size={12} muted>{t('email.formsEmpty')}</T>}
   {formsBusy&&<T size={12} muted>{t('email.formsLoading')}</T>}
   {formsError&&<T size={12} color={c.warn} accessibilityRole="alert">{formsError}</T>}
  </Sheet>
  <ConversationActions panel={panel} onClose={()=>setPanel(null)}/>
 </View>;
}
