import React,{useEffect} from 'react';
import {View,ScrollView,ActivityIndicator} from 'react-native';
import {useApp} from '../store/app';
import {useTheme} from '../theme';
import {t,formatDateTime} from '../i18n/engine';
import {Card,T,Tap,Icon,Button} from './ui';
import type {SessionRow} from '../api/assistant-sessions';

const origin=(row:SessionRow):string|null=>row.context_kind==='conversation'?t('ai.fromConversation'):row.context_kind==='contact'?t('ai.fromContact'):null;

/**
 * A terceira aba da caixa. As sessões não entram no sync periódico: nenhuma outra tela usa
 * esta lista, então ela carrega quando a aba abre e quando a conta troca.
 */
export function AiSessionList(){
 const c=useTheme();
 const s=useApp();
 const accountId=s.active?.id;
 useEffect(()=>{void s.loadAiSessions()},[accountId]);
 const sessions=s.aiSessions;
 return <ScrollView contentContainerStyle={{paddingHorizontal:16,paddingTop:12,paddingBottom:28,gap:12}}>
  <Button label={t('ai.newSession')} testID="ai-new-session" onPress={()=>s.openAssistantSession('new')}/>
  {s.aiSessionsBusy&&!sessions.length&&<View style={{paddingVertical:28,gap:10,alignItems:'center'}}><ActivityIndicator color={c.blue}/><T size={12} muted>{t('ai.loading')}</T></View>}
  {!s.aiSessionsBusy&&!sessions.length&&<Card style={{gap:6,paddingVertical:22,alignItems:'center'}}>
   <Icon name="sparkles-outline" size={26} color={c.blue}/>
   <T bold size={15}>{t('ai.empty')}</T>
   <T size={12} muted style={{textAlign:'center'}}>{t('ai.emptyHint')}</T>
  </Card>}
  {sessions.map(row=><Tap key={row.id} testID={'ai-session-'+row.id} label={row.title||t('ai.untitled')} onPress={()=>s.openAssistantSession(row.id)}>
   <Card style={{flexDirection:'row',alignItems:'center',gap:12}}>
    <View style={{width:40,height:40,borderRadius:13,backgroundColor:c.tintSoft,alignItems:'center',justifyContent:'center'}}><Icon name="sparkles-outline" size={20} color={c.blue}/></View>
    <View style={{flex:1,gap:3}}>
     <T bold size={14} numberOfLines={2}>{row.title||t('ai.untitled')}</T>
     <T size={11} muted numberOfLines={1}>{[origin(row),t('ai.turns',{count:row.turns})].filter(Boolean).join(' · ')}</T>
     <T size={10} color={c.soft}>{formatDateTime(row.updated)}</T>
    </View>
    <Icon name="chevron-forward" size={18} color={c.blue}/>
   </Card>
  </Tap>)}
  {!!sessions.length&&<T size={10} muted style={{textAlign:'center'}}>{t('ai.retention')}</T>}
 </ScrollView>;
}
