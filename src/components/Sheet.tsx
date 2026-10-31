import {t} from '../i18n/engine';
import React from 'react';
import {View,ScrollView,KeyboardAvoidingView,Platform} from 'react-native';
import {OverlayModal} from './OverlayModal';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {T,Tap,Icon} from './ui';
import {useTheme,radius} from '../theme';
export function Sheet({title,visible,onClose,onDismiss,children}:{title:string;visible:boolean;onClose:()=>void;onDismiss?:()=>void;children:React.ReactNode}){
 const c=useTheme();const insets=useSafeAreaInsets();
 return <OverlayModal visible={visible} onClose={onClose} onDismiss={onDismiss}><KeyboardAvoidingView style={{flex:1,justifyContent:'flex-end'}} behavior={Platform.OS==='ios'?'padding':'height'}><Tap label={t("common.closeSheet")} onPress={onClose} style={{flex:1}}><View/></Tap><View style={{maxHeight:'85%',backgroundColor:c.paper,borderTopLeftRadius:radius.sheet,borderTopRightRadius:radius.sheet,paddingBottom:Math.max(insets.bottom,16)}}><View style={{alignItems:'center',paddingTop:8}}><View style={{width:36,height:4,borderRadius:2,backgroundColor:c.line}}/></View><View style={{paddingHorizontal:18,paddingTop:12,paddingBottom:12,flexDirection:'row',gap:12,alignItems:'center'}}><T heavy size={21} line={28} style={{flex:1}}>{title}</T><Tap testID="sheet-close" label={t("common.closeSheet")} onPress={onClose} style={{width:34,alignItems:'center'}}><Icon name="close" size={19}/></Tap></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingHorizontal:18,paddingBottom:18,gap:12}}>{children}</ScrollView></View></KeyboardAvoidingView></OverlayModal>;
}
