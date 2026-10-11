import React,{useMemo} from 'react';
import {View,Text,Linking,Platform} from 'react-native';
import {useTheme,font} from '../theme';
import {useApp} from '../store/app';
import {messageDocument,type MessageNode} from './message-format';
import {T} from './ui';
import {t} from '../i18n/engine';
import {channels,type Channel} from '../api/types';

export const MessageBody=React.memo(function MessageBody({body,channel,whatsapp=false,onEmail}:{body:string;channel?:Channel;whatsapp?:boolean;onEmail?:(email:string)=>void}){
 const c=useTheme();const nodes=useMemo(()=>messageDocument(body,channel),[body,channel]);
 const codeFont=Platform.OS==='ios'?'Menlo':'monospace';
 function inline(node:MessageNode,key:number):React.ReactNode {
  if(node.type==='text'||node.type==='image')return node.text;
  if(node.type==='mention')return <Text key={key} testID={'message-mention-'+node.text?.slice(1)} accessibilityRole="link" accessibilityLabel={t('contact.openProfile',{channel:channel?channels[channel]:''})+' '+node.text} onPress={()=>{if(node.href)void Linking.openURL(node.href).catch(()=>useApp.getState().notify(t('contact.profileOpenError')))}} style={{color:c.blue,fontFamily:font.bold,textDecorationLine:'underline'}}>{node.text}</Text>;
  if(node.type==='softbreak'||node.type==='hardbreak')return '\n';
  const children=node.children.map(inline);
  if(node.type==='link')return <Text key={key} accessibilityRole={node.href?'link':undefined} onPress={node.href?()=>{if(node.href!.startsWith('mailto:')&&onEmail){onEmail(node.href!.slice(7));return}void Linking.openURL(node.href!).catch(()=>useApp.getState().notify(node.href!))}:undefined} style={node.href?{color:c.blue,textDecorationLine:'underline'}:undefined}>{children}</Text>;
  return <Text key={key} style={{fontFamily:node.type==='strong'||(node.type==='em'&&whatsapp&&node.markup==='*')?font.bold:node.type==='code_inline'?codeFont:undefined,fontStyle:node.type==='em'&&!(whatsapp&&node.markup==='*')?'italic':undefined,textDecorationLine:node.type==='s'?'line-through':undefined,backgroundColor:node.type==='code_inline'?c.canvas:undefined}}>{node.type==='code_inline'?node.text:children}</Text>;
 }
 function block(node:MessageNode,key:number):React.ReactNode {
  if(node.type==='inline')return <T key={key} size={15} style={{lineHeight:21}}>{node.children.map(inline)}</T>;
  if(node.type==='fence'||node.type==='code_block')return <T key={key} size={13} style={{fontFamily:codeFont,lineHeight:19,padding:8,backgroundColor:c.canvas,borderRadius:6}}>{node.text}</T>;
  if(node.type==='bullet_list'||node.type==='ordered_list')return <View key={key} style={{gap:4}}>{node.children.map((item,index)=><View key={index} style={{flexDirection:'row',alignItems:'flex-start',gap:7}}><T size={15} style={{lineHeight:21,minWidth:node.type==='ordered_list'?20:10}}>{node.type==='ordered_list'?`${(node.start||1)+index}.`:'•'}</T><View style={{flex:1,minWidth:0,gap:4}}>{item.children.map(block)}</View></View>)}</View>;
  if(node.type==='hr')return <View key={key} style={{height:1,backgroundColor:c.line}}/>;
  if(node.type==='heading')return <T key={key} size={15} bold style={{lineHeight:21}}>{node.children.flatMap(n=>n.children).map(inline)}</T>;
  return <View key={key} style={{gap:4,...(node.type==='blockquote'?{borderLeftWidth:2,borderColor:c.faint,paddingLeft:8}: {})}}>{node.children.map(block)}</View>;
 }
 return <View testID="formatted-message-body" style={{gap:6}}>{nodes.map(block)}</View>;
});
