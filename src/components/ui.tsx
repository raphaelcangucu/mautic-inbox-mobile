import {conversationConnection} from '../api/conversation-connection';
import {t} from '../i18n/engine';
import React from 'react';
import {useSocialVisuals} from './useSocialVisuals';
import {View,Text,Pressable,TextInput,Image,StyleSheet,Platform,type TextProps,type ViewStyle} from 'react-native';
import {Icon} from './Icon';
export {Icon} from './Icon';
import * as Haptics from 'expo-haptics';
import {useTheme,font,radius,channelColor,channelTint} from '../theme';
import {useApp} from '../store/app';
import {channels,type Conversation} from '../api/types';
import {resolvedAvatar} from '../api/avatar';
export function T({size=14,bold=false,semi=false,heavy=false,muted=false,color,line,tracking,style,...props}:TextProps&{size?:number;bold?:boolean;semi?:boolean;heavy?:boolean;muted?:boolean;color?:string;line?:number;tracking?:number}){const c=useTheme();return <Text {...props} style={[{fontFamily:heavy?font.heavy:bold?font.bold:semi?font.semibold:font.regular,fontSize:size,lineHeight:line||size*1.65,includeFontPadding:false,...(tracking?{letterSpacing:tracking}:{}),color:color||(muted?c.soft:c.ink)},style]}/>}
export function Tap({label,onPress,children,style,disabled=false,testID}:{label?:string;onPress:()=>void;children:React.ReactNode;style?:ViewStyle;disabled?:boolean;testID?:string}){return <Pressable accessibilityRole="button" accessibilityLabel={label} testID={testID} hitSlop={4} disabled={disabled} onPress={event=>{event.stopPropagation();void Haptics.selectionAsync().catch(()=>{});onPress()}} style={({pressed})=>[{minHeight:44,justifyContent:'center',...(style?.flexDirection==='row'?{alignItems:'center' as const}:{}),opacity:disabled?.45:pressed?.7:1},style]}>{children}</Pressable>}
export function Button({label,onPress,quiet=false,disabled=false,testID}:{label:string;onPress:()=>void;quiet?:boolean;disabled?:boolean;testID?:string}){const c=useTheme();return <Tap label={label} testID={testID} onPress={onPress} disabled={disabled} style={{backgroundColor:quiet?c.paper:c.blue,borderRadius:radius.button,borderWidth:quiet?1:0,borderColor:quiet?c.lineBlue:c.line,minHeight:52,paddingHorizontal:18,alignItems:'center'}}><T heavy size={16} color={quiet?c.blue:c.paper}>{label}</T></Tap>}
// Chip de filtro de 36 de altura. O ativo ganha o contêiner da primária e o ✓; o inativo é branco com contorno.
// `count` sai como texto ao lado do rótulo; `badge` é o contador cheio do chip de filtros, que abre a folha.
export function Chip({label,active=false,solid=false,count,countTestID,badge,icon,iconOnly=false,onPress,testID}:{label:string;active?:boolean;solid?:boolean;count?:string|number;countTestID?:string;badge?:number;icon?:string;iconOnly?:boolean;onPress:()=>void;testID?:string}){const c=useTheme();const ink=solid&&active?c.paper:active?c.onTint:c.inkStrong;return <Tap label={label} testID={testID} onPress={onPress} style={{height:36,minHeight:36,flexDirection:'row',gap:6,alignItems:'center',paddingHorizontal:solid?16:12,borderRadius:solid?radius.pill:radius.chip,backgroundColor:active?(solid?c.blue:c.tint):c.paper,borderWidth:active?0:1,borderColor:c.line}}>{active&&!solid?<Icon name="checkmark" size={15} strokeWidth={2.2} color={c.onTint}/>:icon?<Icon name={icon} size={16} color={ink}/>:null}{!iconOnly&&<T size={13} bold color={ink}>{label}</T>}{count!==undefined&&<T testID={countTestID} size={13} semi color={active?(solid?c.paper:c.onTint):c.soft}>{count}</T>}{!!badge&&<View style={{minWidth:20,paddingHorizontal:5,height:20,borderRadius:10,backgroundColor:c.blue,alignItems:'center',justifyContent:'center'}}><T size={11} heavy color={c.paper} line={14}>{badge}</T></View>}</Tap>}
// FAB estendido de 56, raio 16, na cor do contêiner da primária.
// Destaca o trecho encontrado, como nos resultados de busca do desenho.
export function Mark({text,query,size=16,heavy=false,semi=false,muted=false,line,numberOfLines}:{text:string;query:string;size?:number;heavy?:boolean;semi?:boolean;muted?:boolean;line?:number;numberOfLines?:number}){
 const c=useTheme();const needle=query.trim().toLocaleLowerCase();const at=needle?text.toLocaleLowerCase().indexOf(needle):-1;
 if(at<0)return <T size={size} heavy={heavy} semi={semi} muted={muted} line={line} numberOfLines={numberOfLines}>{text}</T>;
 return <T size={size} heavy={heavy} semi={semi} muted={muted} line={line} numberOfLines={numberOfLines}>{text.slice(0,at)}<T size={size} heavy semi={false} line={line} style={{backgroundColor:c.highlight}}>{text.slice(at,at+needle.length)}</T>{text.slice(at+needle.length)}</T>;
}
export function Fab({label,onPress,icon='plus',testID}:{label:string;onPress:()=>void;icon?:string;testID?:string}){const c=useTheme();return <Tap label={label} testID={testID} onPress={onPress} style={{height:56,minHeight:56,flexDirection:'row',gap:8,alignItems:'center',paddingHorizontal:20,borderRadius:radius.fab,backgroundColor:c.tint}}><Icon name={icon} size={22} strokeWidth={2.1} color={c.onTint}/><T size={15} heavy color={c.onTint}>{label}</T></Tap>}
export function Card({children,style}:{children:React.ReactNode;style?:ViewStyle}){const c=useTheme();return <View style={[{backgroundColor:c.paper,borderRadius:16,borderWidth:1,borderColor:c.line,padding:15,gap:8},style]}>{children}</View>}
export function Field({label,value,onChange,placeholder,keyboardType='default',testID,multiline=false,code=false}:{label:string;value:string;onChange:(s:string)=>void;placeholder?:string;keyboardType?:React.ComponentProps<typeof TextInput>['keyboardType'];testID?:string;multiline?:boolean;code?:boolean}){const c=useTheme();return <View style={{gap:7}}><T size={13} semi color={c.inkStrong}>{label}</T><TextInput accessibilityLabel={label} testID={testID} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={c.faint} keyboardType={keyboardType} autoCapitalize="none" autoCorrect={false} textContentType={code?"oneTimeCode":keyboardType==="email-address"?"emailAddress":undefined} autoComplete={code?"one-time-code":keyboardType==="email-address"?"email":undefined} maxLength={code?6:undefined} multiline={multiline} style={{backgroundColor:c.field,color:c.ink,fontFamily:font.regular,fontSize:16,includeFontPadding:false,minHeight:52,paddingHorizontal:16,paddingVertical:14,borderWidth:1,borderColor:c.line,borderRadius:radius.button}}/></View>}
const avatars={camila:require('../../assets/avatars/camila.png'),ricardo:require('../../assets/avatars/ricardo.png'),bia:require('../../assets/avatars/bia.png'),lucas:require('../../assets/avatars/lucas.png')};
// Avatar redondo com o selo do canal de 22 e borda da superfície de 2, como no desenho aprovado.
export function Avatar({conversation,size=48,showChannel=true}:{conversation:Conversation;size?:number;showChannel?:boolean}){useSocialVisuals(conversation);const c=useTheme();const mock=useApp(s=>s.active?.mode==='mock');const [failedAvatar,setFailedAvatar]=React.useState<string|null>(null);const badge=Math.max(18,Math.round(size*.46));const tone=(channelColor as Record<string,string>)[conversation.channel]||c.blue;const wash=c.mode==='dark'?c.tint:(channelTint as Record<string,string>)[conversation.channel]||c.tint;const photo=resolvedAvatar(conversation.avatar_url);return <View>
  <View style={{width:size,height:size,borderRadius:size/2,backgroundColor:wash,alignItems:'center',justifyContent:'center'}}><T heavy size={Math.round(size*.34)} color={c.mode==='dark'?c.onTint:tone}>{conversation.contact_name.slice(0,2).toUpperCase()}</T></View>
  {/* A foto cobre as iniciais quando carrega; enquanto falha ou demora, o circulo nunca fica vazio. */}
  {mock&&conversation.mobile.avatarKey?<Image source={avatars[conversation.mobile.avatarKey]} style={{position:'absolute',width:size,height:size,borderRadius:size/2}}/>:photo&&failedAvatar!==photo?<Image onError={()=>setFailedAvatar(photo)} source={{uri:photo}} style={{position:'absolute',width:size,height:size,borderRadius:size/2}}/>:null}
  {showChannel&&<View style={{position:'absolute',bottom:-2,right:-2,width:badge,height:badge,borderWidth:2,borderColor:c.paper,borderRadius:badge/2,backgroundColor:tone,alignItems:'center',justifyContent:'center'}}><Icon name={conversation.channel==='instagram'||conversation.channel==='facebook'?conversation.channel:conversation.channel==='whatsapp'?'phone':conversation.channel==='email'?'mail':'globe'} size={Math.round(badge*.55)} strokeWidth={2} color="#FFFFFF"/></View>}</View>}
export function AssetAvatar({conversation,size=20}:{conversation:Conversation;size?:number}){const c=useTheme();const [failed,setFailed]=React.useState<string|null>(null);return conversation.asset_avatar_url&&failed!==conversation.asset_avatar_url?<Image testID={'asset-avatar-'+conversation.id} source={{uri:conversation.asset_avatar_url}} onError={()=>setFailed(conversation.asset_avatar_url||null)} style={{width:size,height:size,borderRadius:size/3}}/>:<Icon name={conversation.channel} size={size} color={c.blue}/>}
export function Brand(){const c=useTheme();return <View style={{height:28,width:28,backgroundColor:c.blue,borderRadius:9,alignItems:'center',justifyContent:'center'}}><T bold size={18} color={c.paper}>m</T></View>}
export function Top(){
 const c=useTheme();const s=useApp();const count=s.conversations.filter(x=>!x.moderation?.spam&&!x.moderation?.blockedAuthor&&(x.unread>0||x.needs_response)).length;
 const icon={width:40,minHeight:40,height:40,alignItems:'center' as const};
 return <View style={{minHeight:64,flexDirection:'row',gap:4,alignItems:'center',paddingHorizontal:16,paddingVertical:8}}>
  <Tap onPress={()=>s.navigate('accounts')} label={t("nav.switchMautic")} style={{flex:1,flexDirection:'row',gap:10,justifyContent:'flex-start'}}>
   <Brand/>
   <View style={{flex:1,gap:1}}>
    <View style={{flexDirection:'row',gap:5,alignItems:'center'}}><T heavy size={15} line={20} numberOfLines={1} style={{flexShrink:1}}>{s.active?.name||'Mautic Inbox'}</T><Icon name="chevron-down" size={14} color={c.soft}/></View>
    {!!s.active?.user.email&&<View style={{flexDirection:'row',gap:6,alignItems:'center'}}><View testID="availability-dot" style={{width:8,height:8,borderRadius:4,backgroundColor:s.offline||!s.available?c.danger:c.ok}}/><T size={11} line={15} muted numberOfLines={1} style={{flexShrink:1}}>{s.active.user.email}</T></View>}
   </View>
  </Tap>
  <Tap onPress={()=>s.navigate('search')} label={t("inbox.searchLabel")} testID="open-search" style={icon}><Icon name="search-outline" size={23} strokeWidth={1.9}/></Tap>
  <Tap onPress={()=>s.navigate('contacts')} label={t("inbox.newConversation")} testID="new-conversation" style={icon}><Icon name="plus" size={24} strokeWidth={2.1}/></Tap>
  <Tap testID="open-notifications" onPress={()=>s.navigate('notifications')} label={count?t('nav.notificationsCount',{count}):t('nav.notifications')} style={icon}><Icon name="notifications-outline" size={23} strokeWidth={1.9}/>{count>0&&<View pointerEvents="none" style={{position:'absolute',right:0,top:0,minWidth:18,paddingHorizontal:4,height:18,borderWidth:2,borderColor:c.canvas,borderRadius:9,backgroundColor:c.blue,alignItems:'center',justifyContent:'center'}}><T size={9} heavy color={c.paper} line={12}>{count>99?'99+':count}</T></View>}</Tap>
 </View>
}
export function Header({title,right,onBack}:{title:string;right?:React.ReactNode;onBack?:()=>void}){const c=useTheme();const back=useApp(s=>s.back);return <View style={{flexDirection:'row',gap:10,alignItems:'center',paddingHorizontal:12,paddingVertical:10,backgroundColor:c.paper}}><Tap testID="header-back" onPress={onBack||back} label={t("common.back")} style={{width:38,alignItems:'center'}}><Icon name="chevron-back"/></Tap><T bold size={14} style={{flex:1}}>{title}</T>{right}</View>}
export function Tabs({bottomInset}:{bottomInset:number}){
 const c=useTheme();
 const route=useApp(s=>s.route);
 const navigate=useApp(s=>s.navigate);
 const unread=useApp(s=>s.conversations.filter(x=>!x.moderation?.spam&&!x.moderation?.blockedAuthor&&(x.unread>0||x.needs_response)).length);
 const entries=[['inbox',t("nav.conversations"),'chatbubbles-outline'],['assistant',t("nav.assistant"),'sparkles-outline'],['contacts',t("nav.contacts"),'person-outline'],['accounts',t("nav.account"),'settings-outline']] as const;
 // Center the icon/label group with equal 12 pt outer padding on iOS.
 // The touch area ends above the home indicator; other platforms keep their system inset.
 const verticalPadding=12;
 const bottomPadding=Platform.OS==='ios'?verticalPadding:verticalPadding+bottomInset;
 // Indicador em pílula de 60 × 32 no item ativo, sobre a superfície agrupada.
 return <View testID="bottom-tabs" style={{flexDirection:'row',borderTopWidth:1,borderColor:c.divider,backgroundColor:c.canvas,paddingHorizontal:6,paddingTop:verticalPadding,paddingBottom:bottomPadding}}>
  {entries.map(([key,label,icon])=><Tap key={key} onPress={()=>navigate(key)} label={label} testID={'tab-'+key} style={{flex:1,minHeight:44,alignItems:'center',gap:3}}>
   <View style={{width:60,height:32,backgroundColor:route===key?c.tint:'transparent',borderRadius:radius.fab,alignItems:'center',justifyContent:'center'}}>
    <Icon name={icon} size={22} strokeWidth={route===key?2:1.85} color={route===key?c.onTint:c.soft}/>
    {key==='inbox'&&unread>0&&<View pointerEvents="none" style={{position:'absolute',right:6,top:-2,minWidth:18,paddingHorizontal:4,height:18,borderWidth:2,borderColor:c.canvas,borderRadius:9,backgroundColor:c.blue,alignItems:'center',justifyContent:'center'}}><T size={9} heavy color={c.paper} line={12}>{unread>99?'99+':unread}</T></View>}
   </View>
   <T size={11} line={14} bold={route===key} color={route===key?c.onTint:c.soft}>{label}</T>
  </Tap>)}
 </View>
}
export function ChannelLabel({conversation}:{conversation:Conversation}){const c=useTheme();const connection=conversationConnection(conversation);const owner=conversation.mobile.ai?t('common.aiAgent'):conversation.assignee?.id===useApp.getState().active?.user.id?t('common.you'):conversation.assignee?.name||t('filter.unassigned');return <View style={{gap:2}}>{(conversation.channel==='instagram'||conversation.channel==='facebook')&&<View style={{flexDirection:'row',gap:5,alignItems:'center'}}><AssetAvatar conversation={conversation} size={15}/><T size={10} color={c.blue} numberOfLines={1} style={{flex:1,lineHeight:14}}>{conversation.asset.name}</T></View>}{(conversation.channel==='whatsapp'||conversation.channel==='email')&&<T testID={'conversation-connection-'+conversation.id} size={10} color={c.blue} numberOfLines={1} style={{lineHeight:14}}>{connection.name}</T>}<T size={10} color={c.soft} numberOfLines={2} style={{lineHeight:14}}>{channels[conversation.channel]}{connection.phone||connection.address?' · '+(connection.phone||connection.address):''} · {owner}</T></View>}
export const styles=StyleSheet.create({row:{flexDirection:'row',alignItems:'center',gap:10},body:{padding:20,gap:16},iconButton:{width:40,alignItems:'center'}});

export function DetailRow({label,value}:{label:string;value:string}){const c=useTheme();return <View style={{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:12,borderTopWidth:1,borderColor:c.line,paddingVertical:9}}><T size={11} muted style={{flex:1}}>{label}</T><T size={11} bold style={{flex:1,textAlign:'right'}}>{value}</T></View>}
