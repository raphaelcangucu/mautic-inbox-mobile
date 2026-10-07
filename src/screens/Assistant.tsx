import {t} from '../i18n/engine';
import React, {useEffect, useState, useRef} from 'react';
import {View, ScrollView, TextInput, Keyboard, Linking} from 'react-native';
import {useApp} from '../store/app';
import {useTheme, font} from '../theme';
import {T, Tap, Icon, Button, Card, Top} from '../components/ui';
import {Sheet} from '../components/Sheet';
import {assistantConsentKey,checkedAssistantDisclosure,assistantConsentMatches,askConsentedAssistant,type AssistantConsent,type AssistantDisclosure} from '../api/assistant-consent';

type Turn = {id:string; role:'user'|'assistant'; text:string; tool?:string; conversationId?:number};
const prompts = [
  ['megaphone-outline', "assistant.promptCampaigns"],
  ['person-outline', "assistant.promptWaiting"],
  ['chatbubbles-outline', "assistant.promptSummary"],
  ['options-outline', "assistant.promptContactCampaigns"],
] as const;

export function Assistant() {
  const c = useTheme();
  const s = useApp();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [sharingOpen,setSharingOpen]=useState(false);
  const [disclosure,setDisclosure]=useState<AssistantDisclosure|null>(null);
  const [pendingQuestion,setPendingQuestion]=useState<string|null>(null);
  const [consent,setConsent]=useState<AssistantConsent|null>(null);
  const scroll = useRef<ScrollView>(null);
  const follow = useRef(true);
  const requestGeneration = useRef(0);
  useEffect(() => {
    let current = true; ++requestGeneration.current;
    setTurns([]);setInput('');setBusy(false);setSharingOpen(false);setDisclosure(null);setPendingQuestion(null);setConsent(null);follow.current = true;
    void s.repo?.disk.get<Turn[]>('assistant:turns').then(t => {if(current)setTurns(t || [])}).catch(()=>{});
    return () => {current = false; ++requestGeneration.current};
  }, [s.active?.id,s.repo]);

  async function ask(question:string|null) {
    if (busy || (question!==null&&!question.trim())) return;
    if (s.offline) {s.notify(t("assistant.offline"));return}
    const accountId = s.active?.id;
    const repo = s.repo;
    if(!repo)return;
    const generation = ++requestGeneration.current;
    const current = () => requestGeneration.current === generation && useApp.getState().active?.id === accountId;
    follow.current = true;Keyboard.dismiss();
    setBusy(true);if(question!==null)setInput(question);
    try {
      if(s.active?.mode==='mock'){if(question!==null)await submit(question,generation);return}
      // This metadata request carries no question, conversation, CRM data or history.
      const info=checkedAssistantDisclosure(await repo.api.request({method:'GET',path:'/inbox/mobile/assistant/privacy'}));
      const saved=await repo.disk.get<AssistantConsent>(assistantConsentKey);
      if(!current())return;
      setDisclosure(info);setConsent(saved||null);
      if(question!==null&&assistantConsentMatches(saved,info,accountId!,s.active!.origin))await submit(question,generation,info,saved!);
      else {setPendingQuestion(question);setSharingOpen(true)}
    }catch(e){if(current())s.notify(e instanceof Error?e.message:String(e))}
    finally{if(current())setBusy(false)}
  }
  async function submit(question:string,generation:number,info?:AssistantDisclosure,saved?:AssistantConsent){
    const account=s.active;const repo=s.repo;if(!account||!repo)return;
    const current=()=>requestGeneration.current===generation&&useApp.getState().active?.id===account.id;
    if(!current())return;
    setInput('');
    const next = [...turns, {id:String(Date.now()),role:'user' as const,text:question}];
    setTurns(next);
    try {
      const body={message:question,conversation_id:s.conversationId,history:turns.slice(-6)};
      const response = account.mode==='mock'?await repo.api.request<Omit<Turn,'id'>>({method:'POST',path:'/inbox/mobile/assistant/messages',body}):await askConsentedAssistant<Omit<Turn,'id'>>(repo.api,info!,saved||null,account.id,account.origin,body);
      if (!current()) return;
      const complete = [...next, {...response,id:String(Date.now()+1),conversationId:s.conversationId||undefined}];
      setTurns(complete);
      await repo?.disk.put('assistant:turns',complete);
    } catch (e) {if(current()){setInput(question);setTurns(turns);s.notify(e instanceof Error ? e.message : String(e))}}
  }
  async function allowSharing(){
    const account=s.active;const repo=s.repo;if(!account||!repo||!disclosure||busy||s.offline)return;
    const generation=++requestGeneration.current;const current=()=>requestGeneration.current===generation&&useApp.getState().active?.id===account.id;
    const saved:AssistantConsent={accountId:account.id,origin:account.origin,policyId:disclosure.policy_id,acceptedAt:new Date().toISOString()};
    const question=pendingQuestion;setBusy(true);
    try{await repo.disk.put(assistantConsentKey,saved);if(!current())return;setConsent(saved);setSharingOpen(false);setPendingQuestion(null);if(question!==null)await submit(question,generation,disclosure,saved)}
    catch(e){if(current())s.notify(e instanceof Error?e.message:String(e))}
    finally{if(current())setBusy(false)}
  }
  async function revokeSharing(){
    const repo=s.repo;const account=s.active;if(!repo||!account||busy)return;
    const generation=++requestGeneration.current;setBusy(true);
    try{await repo.disk.remove(assistantConsentKey);if(requestGeneration.current!==generation||useApp.getState().active?.id!==account.id)return;setConsent(null);setSharingOpen(false);setPendingQuestion(null);s.notify(t("assistant.revoked"))}
    catch(e){if(requestGeneration.current===generation&&useApp.getState().active?.id===account.id)s.notify(e instanceof Error?e.message:String(e))}
    finally{if(requestGeneration.current===generation&&useApp.getState().active?.id===account.id)setBusy(false)}
  }

  return <View style={{flex:1}}>
    <Top/>
    <ScrollView key={s.active?.id} ref={scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" scrollEventThrottle={32} onScroll={event=>{const {contentOffset,contentSize,layoutMeasurement}=event.nativeEvent;follow.current=contentSize.height-contentOffset.y-layoutMeasurement.height<80}} onContentSizeChange={()=>{if(turns.length>0&&follow.current)scroll.current?.scrollToEnd({animated:true})}} contentContainerStyle={{paddingHorizontal:18,paddingTop:5,paddingBottom:18}}>
      <View style={{flexDirection:'row',gap:9,alignItems:'center',marginTop:6,marginBottom:13}}>
        <Icon name="sparkles-outline" size={20} color={c.blue}/><T size={20} bold style={{flex:1,lineHeight:26,letterSpacing:-.5}}>{t("assistant.title")}</T>
        {s.active?.mode==='live'&&<Tap label={t("assistant.sharing")} testID="assistant-sharing-settings" disabled={busy||s.offline} onPress={()=>void ask(null)} style={{width:40,height:40,minHeight:40,alignItems:'center'}}><Icon name="shield-checkmark-outline" size={20} color={c.soft}/></Tap>}
      </View>
      <View style={{flexDirection:'row',gap:5,alignItems:'center',alignSelf:'flex-start',backgroundColor:c.okBg,borderRadius:7,paddingVertical:5,paddingHorizontal:8}}>
        <Icon name="lock-closed-outline" size={12} color={c.ok}/><T size={9} bold color={c.ok}>{t("assistant.permissions")}</T>
      </View>
      {turns.length === 0 ? <>
        <View style={{width:49,height:49,borderRadius:17,backgroundColor:c.tint,alignItems:'center',justifyContent:'center',marginTop:22,marginBottom:15}}><Icon name="sparkles-outline" size={26} color={c.blue}/></View>
        <T size={27} bold style={{lineHeight:35,letterSpacing:-.8,marginTop:8,marginBottom:2}}>{t('assistant.greeting',{name:s.active?.user.name||''})}</T>
        <T size={13} muted style={{marginVertical:9}}>{t("assistant.intro")}</T>
        <View style={{marginTop:10}}>{prompts.map(([icon,q]) => <Tap key={q} label={t(q)} onPress={() => void ask(t(q))} style={{flexDirection:'row',gap:10,minHeight:58,borderWidth:1,borderColor:c.line,paddingVertical:13,paddingHorizontal:12,borderRadius:13,backgroundColor:c.paper,marginVertical:4.5}}>
          <View style={{width:29,height:29,borderRadius:9,backgroundColor:c.canvas,alignItems:'center',justifyContent:'center'}}><Icon name={icon} color={c.blue} size={16}/></View>
          <T size={12} bold style={{flex:1}}>{t(q)}</T><Icon name="chevron-forward" size={13} color={c.faint}/>
        </Tap>)}</View>
        <View style={{flexDirection:'row',gap:9,marginVertical:20}}><Icon name="shield-checkmark-outline" size={20} color={c.soft}/><T size={10} muted style={{flex:1}}>{s.active?.mode==='mock'?t("assistant.demoResults"):t("assistant.readOnly")}</T></View>
      </> : <View style={{gap:13,paddingTop:16}}>{turns.map(turn => <View key={turn.id} style={{alignSelf:turn.role==='user'?'flex-end':'stretch',maxWidth:turn.role==='user'?'90%':'100%'}}>
        <Card style={{backgroundColor:turn.role==='user'?c.tint:c.paper}}>
          <T size={13}>{turn.text}</T>
          {turn.tool?.startsWith('inbox_context') && turn.conversationId && <Button quiet label={t("assistant.useDraft")} onPress={() => {const id=turn.conversationId!;const repo=s.repo;void s.openChat(id).then(() => {const state=useApp.getState();if(state.repo===repo&&state.route==='chat'&&state.conversationId===id)state.setDraft(turn.text)})}}/>}
          {turn.role==='assistant' && <Button quiet label={t("assistant.viewContacts")} onPress={() => s.navigate('contacts')}/>}
        </Card>
      </View>)}</View>}
      {busy && <T size={11} muted style={{paddingTop:12}}>{s.active?.mode==='mock'?t("assistant.queryDemo"):t("assistant.query")}</T>}
    </ScrollView>
    <View style={{paddingVertical:10,paddingHorizontal:13,borderTopWidth:1,borderColor:c.line,backgroundColor:c.paper}}>
      <View style={{flexDirection:'row',gap:9,alignItems:'center'}}>
        <TextInput testID="assistant-composer" accessibilityLabel={t("assistant.askLabel")} value={input} onChangeText={setInput} placeholder={t("assistant.placeholder")} placeholderTextColor={c.faint} multiline style={{flex:1,color:c.ink,fontFamily:font.regular,fontSize:12,includeFontPadding:false,minHeight:44,maxHeight:100,padding:12,paddingVertical:10,backgroundColor:s.theme==='dark'?c.raised:c.canvas,borderRadius:15}}/>
        <Tap testID="assistant-send" label={t("assistant.send")} disabled={busy} onPress={() => void ask(input)} style={{width:44,height:44,borderRadius:14,backgroundColor:c.blue,alignItems:'center'}}><Icon name="send" size={20} color={c.paper}/></Tap>
      </View>

    </View>
    <Sheet title={t("assistant.sharing")} visible={sharingOpen} onClose={()=>{if(!busy){setSharingOpen(false);setPendingQuestion(null)}}}>
      {disclosure&&<>
        <Card><T bold size={14}>{disclosure.provider} · {s.active?.name}</T><T size={12}>{t('assistant.disclosure',{provider:disclosure.provider,model:disclosure.model})}</T></Card>
        <T size={12}>{t("assistant.dataWarning")}</T>
        <Button quiet label={t("assistant.providerPolicy")} onPress={()=>void Linking.openURL(disclosure.privacy_url).catch(()=>s.notify(t("assistant.providerPolicyError")))}/>
        <T size={11} muted>{t("assistant.consentScope")}</T>
        <Button label={pendingQuestion!==null?t("assistant.authorizeSend"):t("assistant.authorize")} testID="assistant-consent-allow" disabled={busy||s.offline} onPress={()=>void allowSharing()}/>
        {assistantConsentMatches(consent,disclosure,s.active?.id||'',s.active?.origin||'')&&<Button quiet label={t("assistant.revoke")} testID="assistant-consent-revoke" disabled={busy} onPress={()=>void revokeSharing()}/>}
        <Button quiet label={t("assistant.notNow")} testID="assistant-consent-cancel" disabled={busy} onPress={()=>{setSharingOpen(false);setPendingQuestion(null)}}/>
      </>}
    </Sheet>
  </View>;
}
