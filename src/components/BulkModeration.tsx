import {t} from '../i18n/engine.ts';
import React,{useEffect,useState} from 'react';
import {View} from 'react-native';
import {Button,T} from './ui';
import {Sheet} from './Sheet';
import {useApp} from '../store/app';
import {useTheme} from '../theme';
import {moderateSelection,mergeModeration} from '../api/moderation';
import type {Conversation} from '../api/types';

export function BulkModeration({selected,onClose,onComplete}:{selected:Conversation[];onClose:()=>void;onComplete:()=>void}){
 const s=useApp();const c=useTheme();const [busy,setBusy]=useState(false);const [progress,setProgress]=useState('');const [error,setError]=useState('');
 useEffect(()=>{setError('');setProgress('')},[selected]);
 const names=[...new Set(selected.map(p=>p.contact_name))];
 async function run(action:'spam'|'block'|'spam_block'|'hide'){
  if(busy||!s.repo||s.offline)return;
  const repo=s.repo;const account=s.active?.id;
  const valid=()=>useApp.getState().active?.id===account&&useApp.getState().repo===repo;
  setBusy(true);setError('');let applying=Promise.resolve();
  try{
   const result=await moderateSelection(repo.api,selected,action,valid,fresh=>{applying=applying.then(async()=>{if(!valid())return;
    const previous=useApp.getState().conversations;const conversations=mergeModeration(previous,fresh);
    await repo.saveConversations(conversations.filter((p,index)=>p!==previous[index]));if(valid())useApp.setState({conversations});});return applying;
   },(done,total)=>setProgress(t("bulk.progress",{done,total})));
   if(!valid())return;
   if(result.failures.length){setError(t("bulk.failures",{done:result.done,failed:result.failures.length,message:result.failures[0].message}));}
   else{s.notify(result.total?t("bulk.completed",{count:result.done}):t("bulk.already"));onComplete();}
  }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
 }
 return <Sheet title={t("bulk.title")} visible={selected.length>0} onClose={()=>{if(!busy)onClose()}}>
  <T bold size={13}>{t("bulk.comments",{count:selected.length})} · {t("bulk.authors",{count:names.length})}</T>
  <T size={12} muted>{t("bulk.hint")}</T>
  <View style={{maxHeight:130}}><T size={11} muted numberOfLines={6}>{names.join(', ')}</T></View>
  <Button label={t("bulk.spamBlock")} disabled={busy||s.offline} onPress={()=>void run('spam_block')}/>
  <Button quiet label={t("bulk.spam")} disabled={busy||s.offline} onPress={()=>void run('spam')}/>
  <Button quiet label={t("bulk.block")} disabled={busy||s.offline} onPress={()=>void run('block')}/>
  {selected.every(p=>p.channel==='instagram')&&<Button quiet label={t("bulk.hide")} disabled={busy||s.offline} onPress={()=>void run('hide')}/>}
  {progress&&<T size={12} color={c.blue}>{progress}</T>}
  {error&&<T size={12} color={c.warn} accessibilityRole="alert">{error}</T>}
 </Sheet>;
}
