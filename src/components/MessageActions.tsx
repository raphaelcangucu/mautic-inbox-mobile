import React,{useEffect,useRef,useState} from 'react';
import {View,Platform,Share,Keyboard,TextInput} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {useApp} from '../store/app';
import {useTheme,font} from '../theme';
import {t,formatDateTime} from '../i18n/engine';
import {conversationConnection} from '../api/conversation-connection';
import {forwardedDraft,forwardTargets} from '../api/message-forward';
import {type Message} from '../api/types';
import {Sheet} from './Sheet';
import {T,Tap,Icon,Button} from './ui';
export function MessageActions({message,favorite,onClose,onFavorite}:{message:Message|null;favorite:boolean;onClose:()=>void;onFavorite:()=>Promise<void>}){
 const c=useTheme();const s=useApp();const [busy,setBusy]=useState(false);const [error,setError]=useState('');const lock=useRef(false);const pending=useRef<(()=>void)|null>(null);
 useEffect(()=>()=>{pending.current=null},[]);
 useEffect(()=>setError(''),[message]);
 const valid=(account=s.active?.id,repo=s.repo)=>useApp.getState().active?.id===account&&useApp.getState().repo===repo;
 function row(label:string,icon:string,action:()=>void,testID:string,disabled=false){return <Tap label={label} testID={testID} disabled={busy||disabled} onPress={action} style={{flexDirection:'row',gap:14,paddingVertical:8,minHeight:50}}><Icon name={icon} color={c.blue} size={21}/><T size={14} style={{flex:1}}>{label}</T></Tap>}
 async function copy(){if(!message||lock.current)return;lock.current=true;setBusy(true);try{const account=s.active?.id,repo=s.repo;const copied=await Clipboard.setStringAsync(message.body);if(!copied)throw Error();if(valid(account,repo)){onClose();s.notify(t('message.copied'))}}catch{setError(t('message.copyError'))}finally{lock.current=false;setBusy(false)}}
 async function favoriteMessage(){if(lock.current)return;lock.current=true;setBusy(true);try{await onFavorite();onClose()}catch{setError(t('message.favoriteError'))}finally{lock.current=false;setBusy(false)}}
 function share(){if(!message)return;const text=message.body,account=s.active?.id,repo=s.repo;const run=()=>{if(valid(account,repo))void Share.share({message:text}).catch(()=>s.notify(t('message.shareError')))};if(Platform.OS==='ios'){pending.current=run;onClose()}else{onClose();run()}}
 const [forward,setForward]=useState(false);const [search,setSearch]=useState('');const [limit,setLimit]=useState(20);const forwarding=useRef(false);
 const source=useRef<Message|null>(null);
 async function choose(id:number){const m=source.current;if(!m||forwarding.current||!s.repo)return;forwarding.current=true;setBusy(true);const repo=s.repo,account=s.active?.id;try{
  // Check length before navigating; never overwrite the destination's existing draft.
  forwardedDraft(await repo.drafts(id,'reply'),m.body);
  if(!valid(account,repo))return;await s.openChat(id);const current=useApp.getState();if(!valid(account,repo)||current.route!=='chat'||current.conversationId!==id)return;
  current.setDraft(forwardedDraft(current.draft,m.body));setForward(false);source.current=null;current.notify(t('message.forwardReady'));
 }catch(e){setError(e instanceof Error&&e.message==='forward_too_long'?t('message.forwardTooLong'):t('message.forwardError'))}finally{forwarding.current=false;setBusy(false)}}
 function startForward(){if(!message)return;source.current=message;setError('');setSearch('');setLimit(20);Keyboard.dismiss();const run=()=>{if(valid())setForward(true)};if(Platform.OS==='ios'){pending.current=run;onClose()}else{onClose();run()}}
 const targets=forwardTargets(s.conversations,s.conversationId,search);
 return <>
 <Sheet title={t('message.actions')} visible={!!message} onClose={()=>{if(!busy)onClose()}} onDismiss={()=>{const run=pending.current;pending.current=null;run?.()}}>
  {message&&<View style={{borderBottomWidth:1,borderColor:c.line,paddingBottom:12,gap:5}}><T size={13} numberOfLines={4}>{message.body||message.attachment?.name||t('message.noText')}</T>{message.kind==='note'&&<T size={11} color={c.warn}>{t('chat.internalTeam')}</T>}<T size={11} muted>{formatDateTime(message.timestamp)}</T></View>}
  {error&&<T size={12} color={c.warn} accessibilityRole="alert">{error}</T>}
  <View>
  {row(t('message.copy'),'copy',()=>void copy(),'message-copy',!message?.body.trim())}
  {row(t(favorite?'message.unfavorite':'message.favorite'),'star',()=>void favoriteMessage(),'message-favorite')}
  {row(t('message.forward'),'forward',startForward,'message-forward',!message?.body.trim())}
  {row(t('message.share'),'share',share,'message-share',!message?.body.trim())}
  </View>
 </Sheet>
 <Sheet title={t('message.forward')} visible={forward} onClose={()=>{if(!busy){setForward(false);source.current=null}}}>
  <T size={12} muted>{t('message.forwardHint')}</T>
  {error&&<T size={12} color={c.warn} accessibilityRole="alert">{error}</T>}
  {source.current&&<T size={12} numberOfLines={3}>{source.current.body}</T>}
  <TextInput testID="forward-search" accessibilityLabel={t('message.search')} value={search} onChangeText={value=>{setSearch(value);setLimit(20)}} placeholder={t('message.search')} placeholderTextColor={c.faint} style={{minHeight:44,padding:12,color:c.ink,fontFamily:font.regular,backgroundColor:c.canvas,borderRadius:12}}/>
  {!targets.length&&<T size={13} muted>{t('message.noTargets')}</T>}
  {targets.slice(0,limit).map(target=>{const connection=conversationConnection(target);return <Tap key={target.id} testID={'forward-to-'+target.id} label={target.contact_name+' · '+connection.label} disabled={busy} onPress={()=>void choose(target.id)} style={{minHeight:56,borderBottomWidth:1,borderColor:c.line,paddingVertical:8,gap:3}}><T bold size={13}>{target.contact_name}</T><T size={11} muted>{connection.label}{connection.phone?' · '+connection.phone:''}</T></Tap>})}
  {targets.length>limit&&<Button quiet label={t('message.moreTargets')} disabled={busy} onPress={()=>setLimit(n=>n+20)}/>}
  {!s.listComplete&&<Button quiet label={t('message.loadConversations')} disabled={busy||s.syncing||s.offline} onPress={()=>void s.moreConversations()}/>}
 </Sheet>
 </>;
}
