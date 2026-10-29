import React,{useEffect,useMemo,useRef,useState} from 'react';
import {View,ScrollView,TextInput} from 'react-native';
import {t,formatTime} from '../i18n/engine';
import {conversationSearch} from '../api/conversation-connection';
import {StartContactConversation,type ContactCard} from '../components/ContactDirectory';
import {T,Tap,Icon,Avatar,Chip,Mark} from '../components/ui';
import {useApp} from '../store/app';
import {useTheme,font,radius} from '../theme';
import type {Conversation} from '../api/types';

type Page<T>={items:T[];next_cursor:string|null};
type Scope='all'|'conversations'|'contacts';

/** Busca única: conversas já carregadas e contatos do Mautic, pelo nome e pelo contato — nunca pelo texto das mensagens. */
export function Search(){
 const c=useTheme();const s=useApp();
 const [query,setQuery]=useState(s.view.search);const [scope,setScope]=useState<Scope>('all');
 const [contacts,setContacts]=useState<ContactCard[]>([]);const [loading,setLoading]=useState(false);const [error,setError]=useState('');
 const seq=useRef(0);const field=useRef<TextInput>(null);
 const conversations=useMemo(()=>query.trim()?s.conversations.filter(p=>conversationSearch(p,query)):[],[s.conversations,query]);
 useEffect(()=>{const timer=setTimeout(()=>field.current?.focus(),120);return()=>clearTimeout(timer)},[]);
 useEffect(()=>{
  const generation=++seq.current;const repo=s.repo;const account=s.active?.id;const search=query.trim();
  if(!repo||!search){setContacts([]);setError('');setLoading(false);return}
  const valid=()=>generation===seq.current&&useApp.getState().active?.id===account;
  const timer=setTimeout(()=>{void(async()=>{
   setLoading(true);setError('');
   const key='contacts:list:'+JSON.stringify([search,0,0,null]);
   try{
    const cached=await repo.disk.get<Page<ContactCard>>(key);
    if(cached&&valid())setContacts(cached.items);
    if(s.offline){if(!cached&&valid()){setContacts([]);setError(t("contact.searchOffline"))}return}
    const fresh=await repo.api.request<Page<ContactCard>>({method:'GET',path:'/inbox/mobile/contacts',query:{search,segment_id:0,campaign_id:0,limit:30}});
    await repo.disk.put(key,fresh);
    if(valid())setContacts(fresh.items)
   }catch(e){if(valid())setError(e instanceof Error?e.message:String(e))}
   finally{if(valid())setLoading(false)}
  })()},250);
  return()=>{clearTimeout(timer);seq.current++};
 },[s.repo,s.active?.id,s.offline,query]);
 // Abrir pela busca volta para a caixa, não para cá, como no resto do app.
 const open=(p:Conversation)=>{s.setView({search:'',listOffset:0});void s.openChat(p.id)};
 const showConversations=scope!=='contacts'&&!!conversations.length;
 const showContacts=scope!=='conversations'&&!!contacts.length;
 return <View style={{flex:1,backgroundColor:c.paper}}>
  <View style={{flexDirection:'row',gap:8,alignItems:'center',paddingHorizontal:8,paddingVertical:8}}>
   <Tap label={t("common.back")} testID="search-back" onPress={()=>s.back()} style={{width:40,alignItems:'center'}}><Icon name="chevron-back" size={22}/></Tap>
   <View style={{flex:1,height:48,flexDirection:'row',gap:10,alignItems:'center',paddingHorizontal:16,borderRadius:radius.pill+4,backgroundColor:c.field}}>
    <TextInput ref={field} accessibilityLabel={t("inbox.searchLabel")} testID="search-conversations" value={query} onChangeText={setQuery} placeholder={t("inbox.searchPlaceholder")} placeholderTextColor={c.faint} autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={{flex:1,color:c.ink,fontFamily:font.regular,fontSize:16,paddingVertical:0,includeFontPadding:false}}/>
    {!!query&&<Tap label={t("inbox.clearSearch")} testID="search-clear" onPress={()=>setQuery('')} style={{width:28,alignItems:'center'}}><Icon name="close" size={20} color={c.soft}/></Tap>}
   </View>
  </View>
  <View style={{flexDirection:'row',gap:8,paddingHorizontal:16,paddingBottom:10}}>
   <Chip label={t("search.all")} solid active={scope==='all'} testID="scope-all" onPress={()=>setScope('all')}/>
   <Chip label={t("nav.conversations")} solid active={scope==='conversations'} count={conversations.length} testID="scope-conversations" onPress={()=>setScope('conversations')}/>
   <Chip label={t("nav.contacts")} solid active={scope==='contacts'} count={contacts.length} testID="scope-contacts" onPress={()=>setScope('contacts')}/>
  </View>
  <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{paddingBottom:24}}>
   {showConversations&&<T size={13} heavy line={18} color={c.inkStrong} style={{paddingHorizontal:16,paddingTop:6,paddingBottom:8}}>{t("nav.conversations")}</T>}
   {showConversations&&conversations.map(p=><Tap key={p.id} testID={'conversation-'+p.id} label={t("inbox.openContact",{name:p.contact_name})} onPress={()=>open(p)} style={{flexDirection:'row',gap:12,alignItems:'flex-start',paddingHorizontal:16,paddingVertical:10,borderBottomWidth:1,borderColor:c.dividerSoft}}>
    <Avatar conversation={p}/>
    <View style={{flex:1,gap:3}}>
     <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
      <View style={{flex:1}}><Mark text={p.contact_name} query={query} size={16} semi line={22} numberOfLines={1}/></View>
      <T size={11} line={14} semi color={c.faint}>{formatTime(p.last_message_at)}</T>
     </View>
     <T size={15} line={21} muted numberOfLines={1}>{p.channel==='email'&&p.subject?p.subject:p.preview}</T>
    </View>
   </Tap>)}
   {showContacts&&<T size={13} heavy line={18} color={c.inkStrong} style={{paddingHorizontal:16,paddingTop:16,paddingBottom:8}}>{t("search.contactsInMautic")}</T>}
   {showContacts&&contacts.map(contact=><View key={contact.id} testID={'search-contact-'+contact.id} style={{flexDirection:'row',gap:12,alignItems:'center',paddingHorizontal:16,paddingVertical:10,borderBottomWidth:1,borderColor:c.dividerSoft}}>
    <View style={{width:48,height:48,borderRadius:24,backgroundColor:c.tintSoft,alignItems:'center',justifyContent:'center'}}><T heavy size={16} color={c.onTint}>{contact.name.slice(0,2).toUpperCase()}</T></View>
    <View style={{flex:1,gap:2}}>
     <Mark text={contact.name} query={query} size={16} semi line={22} numberOfLines={1}/>
     <T size={14} line={19} muted numberOfLines={1}>{[contact.email||contact.phone,t("search.noConversation")].filter(Boolean).join(' · ')}</T>
    </View>
    <StartContactConversation contactId={contact.id} compact/>
   </View>)}
   {showContacts&&<Tap label={t("search.seeContacts",{count:contacts.length})} testID="search-see-contacts" onPress={()=>s.navigate('contacts')} style={{flexDirection:'row',gap:8,paddingHorizontal:16,paddingTop:16,minHeight:44}}><T size={15} heavy color={c.blue}>{t("search.seeContacts",{count:contacts.length})}</T><Icon name="chevron-forward" size={18} color={c.blue}/></Tap>}
   {!!query.trim()&&!loading&&!conversations.length&&!contacts.length&&!error&&<T size={14} muted style={{padding:24,textAlign:'center'}}>{t("contact.emptySearch")}</T>}
   {loading&&<T size={13} muted style={{paddingHorizontal:16,paddingVertical:10}}>{t("contact.loadingContacts")}</T>}
   {!!error&&<T size={13} color={c.warn} accessibilityRole="alert" style={{paddingHorizontal:16,paddingVertical:10}}>{error}</T>}
  </ScrollView>
 </View>;
}
