import {conversationSearch,conversationConnection} from '../api/conversation-connection';
import {filterLabel} from '../i18n/filter-label';
import {formatTime,formatNumber} from '../i18n/engine';
import {t} from '../i18n/engine';
import {Sheet} from '../components/Sheet';
import {BulkModeration} from '../components/BulkModeration';
import React,{useRef,useEffect,useState,useMemo} from 'react';
import {Image,View,TextInput,ScrollView,FlatList,RefreshControl} from 'react-native';
import {T,Tap,Icon,Avatar,ChannelLabel,Button,Top,Chip} from '../components/ui';
import {SwipeRow,type SwipeAction} from '../components/SwipeRow';
import {useTheme,font,scale,channelColor} from '../theme';
import {useApp} from '../store/app';
import {channels,filters,matches,type Channel,type Conversation} from '../api/types';
export function Inbox(){
  const c=useTheme();const s=useApp();const rail=useRef<ScrollView>(null);const list=useRef<FlatList>(null);const listOffset=useRef(0);const [filterSheet,setFilterSheet]=useState(false);const [selected,setSelected]=useState(s.view.channels);const view=s.view;const [selecting,setSelecting]=useState(false);const [selection,setSelection]=useState<number[]>([]);const [review,setReview]=useState<Conversation[]>([]);
  useEffect(()=>{setSelecting(false);setSelection([]);setReview([])},[s.active?.id,view.kind,view.search,view.filter,view.channels]);
  const base=useMemo(()=>s.conversations.filter(p=>(p.kind||'inbox')===(view.kind||'inbox')&&view.channels.includes(p.channel)&&conversationSearch(p,view.search)),[s.conversations,view.channels,view.search,view.kind]);
  const shown=base.filter(p=>matches(p,view.filter,s.active?.user.id||0));
  const likelySpam=useMemo(()=>s.conversations.filter(x=>(x.kind||'inbox')==='comments'&&x.moderation?.spam&&!x.moderation?.hidden),[s.conversations]);
  const commentCount=useMemo(()=>s.conversations.filter(x=>(x.kind||'inbox')==='comments').length,[s.conversations]);
  // Conta o que está restringindo a lista, para o badge do chip de filtros.
  const activeFilters=(view.filter!=='Todas'?1:0)+(view.channels.length!==Object.keys(channels).length?1:0)+(view.search?1:0);
  useEffect(()=>{const timer=setTimeout(()=>{rail.current?.scrollTo({x:view.railOffset,animated:false});list.current?.scrollToOffset({offset:view.listOffset,animated:false})},60);return()=>{clearTimeout(timer);useApp.getState().setView({listOffset:listOffset.current})}},[]);
  // Arrastar para o lado age na conversa sem abri-la; o gesto não aparece na seleção nem nos comentários.
  const swipeActions=(p:Conversation):SwipeAction[]=>[
   {label:t("inbox.swipeTake"),icon:'person-outline',color:c.blue,testID:'swipe-take-'+p.id,onPress:()=>void s.transition('take',{},p.id)},
   {label:t("inbox.swipeResolve"),icon:'check',color:c.ok,testID:'swipe-resolve-'+p.id,onPress:()=>void s.transition('resolve',{},p.id)},
  ];
  const item=({item:p}:{item:Conversation})=>{
   const body=<Tap onPress={()=>selecting?setSelection(selection.includes(p.id)?selection.filter(id=>id!==p.id):[...selection,p.id]):void s.openChat(p.id)} label={t(selecting?"inbox.selectContact":"inbox.openContact",{name:p.contact_name})+(p.channel==='whatsapp'||p.channel==='email'?" · "+conversationConnection(p).label:"")+(p.channel==='email'&&p.subject?" · "+p.subject:"")} testID={'conversation-'+p.id} style={{flexDirection:'row',gap:12,alignItems:'flex-start',paddingVertical:10,paddingHorizontal:16,borderBottomWidth:1,borderColor:c.dividerSoft,backgroundColor:c.paper}}>
    {selecting?<View style={{width:48,height:48,alignItems:'center',justifyContent:'center'}}><Icon name={selection.includes(p.id)?'checkbox':'square-outline'} color={c.blue}/></View>:<Avatar conversation={p}/>}
    <View style={{flex:1,gap:3}}>
     <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
      <T size={16} heavy={p.unread>0} semi={!p.unread} numberOfLines={1} line={22} style={{flex:1}}>{p.contact_name}</T>
      <T size={11} line={14} heavy={p.unread>0} semi={!p.unread} color={p.unread>0?c.blue:c.faint}>{formatTime(p.last_message_at)}</T>
     </View>
     {p.channel==='email'&&!!p.subject&&<T testID={'conversation-subject-'+p.id} size={15} line={21} heavy={p.unread>0} semi={!p.unread} numberOfLines={1}>{p.subject}</T>}
     <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
      <T size={15} line={21} muted numberOfLines={1} style={{flex:1}}>{p.preview}</T>
      {p.unread>0&&<View style={{backgroundColor:c.blue,borderRadius:10,minWidth:20,height:20,paddingHorizontal:5,alignItems:'center',justifyContent:'center'}}><T size={11} heavy line={14} color={c.paper}>{formatNumber(p.unread)}</T></View>}
     </View>
     <ChannelLabel conversation={p}/>
     {view.kind==='comments'&&!selecting&&<View style={{flexDirection:'row',gap:8,paddingTop:6}}>
      {p.comment?.canPublic!==false&&<Tap testID={'comment-reply-public-'+p.id} label={t("inbox.replyPublic")} onPress={()=>{useApp.setState({replyMode:'public'});void s.openChat(p.id)}} style={{height:34,minHeight:34,paddingHorizontal:14,justifyContent:'center',borderRadius:17,backgroundColor:c.tintSoft}}><T size={13} heavy color={c.blue}>{t("inbox.replyPublic")}</T></Tap>}
      {!!p.comment?.canPrivate&&<Tap testID={'comment-reply-private-'+p.id} label={t("inbox.replyPrivate")} onPress={()=>{useApp.setState({replyMode:'private'});void s.openChat(p.id)}} style={{height:34,minHeight:34,paddingHorizontal:14,justifyContent:'center',borderRadius:17,backgroundColor:c.tintSoft}}><T size={13} heavy color={c.blue}>{t("inbox.replyPrivate")}</T></Tap>}
     </View>}
     {(p.kind==='comments'||p.moderation?.spam||p.moderation?.blockedAuthor)&&<T size={11} color={c.blue} numberOfLines={1}>{p.moderation?.hidden?t("inbox.hiddenInstagram"):p.moderation?.blockedAuthor?t("inbox.blockedAuthor"):p.moderation?.spam?'Spam':p.moderation?.hidden?t("inbox.hidden"):p.comment?.postTitle}</T>}
    </View>
    {p.kind==='comments'&&p.comment?.image&&<Image testID={'post-thumbnail-'+p.id} source={{uri:p.comment.image}} style={{width:44,height:44,borderRadius:9,backgroundColor:c.raised}}/>}
   </Tap>;
   return selecting||view.kind==='comments'?body:<SwipeRow actions={swipeActions(p)} enabled={!s.offline}>{body}</SwipeRow>;
  };
  return <View style={{flex:1}}><Top/><View style={{paddingHorizontal:18,paddingTop:5}}><View style={{flexDirection:'row',marginTop:10,borderBottomWidth:1,borderColor:c.divider}}>{([['inbox',t("nav.conversations")],['comments',t("nav.comments")]] as const).map(([kind,label])=><Tap key={kind} label={label} testID={'kind-'+kind} onPress={()=>{s.setView({kind,filter:'Todas',listOffset:0,railOffset:0});rail.current?.scrollTo({x:0,animated:false});list.current?.scrollToOffset({offset:0,animated:false})}} style={{flex:1,minHeight:44,flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center',paddingBottom:10,borderBottomWidth:3,borderColor:view.kind===kind?c.blue:'transparent'}}><T size={15} heavy={view.kind===kind} semi={view.kind!==kind} color={view.kind===kind?c.blue:c.soft}>{label}</T>{kind==='comments'&&!!commentCount&&<View style={{minWidth:26,height:22,paddingHorizontal:7,borderRadius:11,backgroundColor:c.chip,alignItems:'center',justifyContent:'center'}}><T size={12} semi line={15} color={c.soft}>{formatNumber(commentCount)}</T></View>}</Tap>)}</View><View style={{flexDirection:'row',alignItems:'center',gap:6}}><ScrollView ref={rail} horizontal style={{height:36,maxHeight:36,flex:1,marginTop:12,marginBottom:7}} showsHorizontalScrollIndicator={false} onScroll={e=>s.setView({railOffset:e.nativeEvent.contentOffset.x})} scrollEventThrottle={100} contentContainerStyle={{gap:6,alignItems:'center'}}><Chip testID="open-filters" label={t("inbox.filterPicker")} icon="options-outline" iconOnly badge={activeFilters} onPress={()=>{setSelected(view.channels);setFilterSheet(true)}}/>{filters.map(label=><Chip key={label} label={filterLabel(label)} testID={'filter-'+label} active={view.filter===label} count={formatNumber(base.filter(p=>matches(p,label,s.active?.user.id||0)).length)} countTestID={'count-'+label} onPress={()=>{s.setView({filter:label,listOffset:0});list.current?.scrollToOffset({offset:0,animated:false})}}/>)}</ScrollView></View><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>{view.kind==='comments'&&<Tap label={selecting?t("inbox.cancelSelection"):t("inbox.selectComments")} onPress={()=>{setSelecting(!selecting);setSelection([])}} style={{minHeight:30}}><T size={10} color={c.blue}>{selecting?t("common.cancel"):t("inbox.select")}</T></Tap>}</View>{selecting&&<View style={{flexDirection:'row',alignItems:'center',gap:8,paddingBottom:10}}><Tap label={t("inbox.selectAllFilter")} onPress={()=>setSelection(shown.map(p=>p.id))} style={{flex:1,minHeight:40}}><T size={11} color={c.blue}>{t('inbox.selectedAll',{count:selection.length})}</T></Tap><Button label={t("inbox.moderate")} disabled={!selection.length||s.offline} onPress={()=>setReview(shown.filter(p=>selection.includes(p.id)))}/></View>}</View>
  {view.kind==='comments'&&!!likelySpam.length&&!selecting&&<Tap testID="spam-batch-card" label={t("inbox.likelySpam",{count:likelySpam.length})} onPress={()=>setReview(likelySpam)} style={{flexDirection:'row',gap:14,alignItems:'center',marginHorizontal:16,marginBottom:12,padding:14,borderRadius:16,backgroundColor:c.tintSofter}}>
   <View style={{width:44,height:44,borderRadius:22,backgroundColor:c.blue,alignItems:'center',justifyContent:'center'}}><Icon name="sparkles-outline" size={22} color={c.paper}/></View>
   <View style={{flex:1,gap:2}}><T size={16} heavy line={21}>{t("inbox.likelySpam",{count:likelySpam.length})}</T><T size={14} line={19} muted>{t("inbox.likelySpamHint")}</T></View>
   <Icon name="chevron-forward" size={20} color={c.soft}/>
  </Tap>}
  <FlatList ref={list} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" data={shown} onEndReached={()=>{if(!view.search)void s.moreConversations()}} onEndReachedThreshold={.3} keyExtractor={p=>String(p.id)} renderItem={item} style={{backgroundColor:c.paper}} contentContainerStyle={{paddingTop:0,paddingBottom:24}} onScroll={e=>{listOffset.current=e.nativeEvent.contentOffset.y}} scrollEventThrottle={160} refreshControl={<RefreshControl refreshing={s.refreshingList} onRefresh={()=>void s.sync(true,true)} tintColor={c.blue}/>} ListEmptyComponent={<View style={{paddingVertical:25,gap:15}}><T bold>{s.syncing&&!s.conversations.length?t("inbox.loadingFirst"):t("inbox.empty")}</T><T muted>{t("inbox.emptyHint")}</T><Button quiet label={t("inbox.clearFilters")} onPress={()=>s.setView({filter:'Todas',search:'',channels:Object.keys(channels) as Channel[]})}/></View>}/>
  <BulkModeration selected={review} onClose={()=>setReview([])} onComplete={()=>{setReview([]);setSelecting(false);setSelection([])}}/>
  <Sheet title={t("inbox.filterConversations")} visible={filterSheet} onClose={()=>setFilterSheet(false)}>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{filters.map(label=><Chip key={label} label={filterLabel(label)} active={view.filter===label} count={formatNumber(base.filter(p=>matches(p,label,s.active?.user.id||0)).length)} onPress={()=>{s.setView({filter:label,listOffset:0});list.current?.scrollToOffset({offset:0,animated:false});if(label==='Spam')rail.current?.scrollToEnd({animated:false})}}/>)}</View>
   <T size={13} semi line={18} color={c.inkStrong} style={{marginTop:10}}>{t("inbox.filterChannels")}</T>
   {(Object.keys(channels) as Channel[]).map(key=>{const on=selected.includes(key);const total=s.conversations.filter(x=>(x.kind||'inbox')===(view.kind||'inbox')&&x.channel===key).length;return <Tap key={key} label={channels[key]+', '+total} testID={'channel-'+key} onPress={()=>setSelected(on?selected.filter(x=>x!==key):[...selected,key])} style={{flexDirection:'row',gap:14,alignItems:'center',minHeight:56}}>
    <View style={{width:44,height:44,borderRadius:22,backgroundColor:channelColor[key],alignItems:'center',justifyContent:'center'}}><Icon name={key==='whatsapp'?'phone':key==='email'?'mail':key==='webchat'?'globe':key} size={20} strokeWidth={2.1} color="#FFFFFF"/></View>
    <T size={16} semi style={{flex:1}}>{channels[key]}</T>
    <T testID={'channel-count-'+key} size={14} color={c.soft}>{formatNumber(total)}</T>
    <View style={{width:28,height:28,borderRadius:8,borderWidth:2,borderColor:on?c.blue:c.faint,backgroundColor:on?c.blue:'transparent',alignItems:'center',justifyContent:'center'}}>{on&&<Icon name="checkmark" size={16} strokeWidth={2.8} color="#FFFFFF"/>}</View>
   </Tap>})}
   <Button label={t("inbox.showCount",{count:s.conversations.filter(p=>(p.kind||'inbox')===(view.kind||'inbox')&&selected.includes(p.channel)&&conversationSearch(p,view.search)&&matches(p,view.filter,s.active?.user.id||0)).length})} disabled={!selected.length} onPress={()=>{s.setView({channels:selected,listOffset:0});list.current?.scrollToOffset({offset:0,animated:false});setFilterSheet(false)}}/>
  </Sheet></View>;
}
