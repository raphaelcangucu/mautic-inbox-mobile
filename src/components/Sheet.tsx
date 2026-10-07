import {t} from '../i18n/engine';
import React from 'react';
import {View,ScrollView,KeyboardAvoidingView,Platform} from 'react-native';
import {OverlayModal} from './OverlayModal';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {T,Tap,Icon} from './ui';
import {useTheme} from '../theme';
export function Sheet({title,visible,onClose,children}:{title:string;visible:boolean;onClose:()=>void;children:React.ReactNode}){
 const c=useTheme();const insets=useSafeAreaInsets();
 return <OverlayModal visible={visible} onClose={onClose}><KeyboardAvoidingView style={{flex:1,justifyContent:'flex-end'}} behavior={Platform.OS==='ios'?'padding':'height'}><Tap label={t("common.closeSheet")} onPress={onClose} style={{flex:1}}><View/></Tap><View style={{maxHeight:'85%',backgroundColor:c.paper,borderTopLeftRadius:24,borderTopRightRadius:24,paddingBottom:Math.max(insets.bottom,16)}}><View style={{paddingHorizontal:18,paddingTop:18,paddingBottom:12,flexDirection:'row',gap:12,alignItems:'center'}}><T bold size={18} style={{flex:1}}>{title}</T><Tap label={t("common.closeSheet")} onPress={onClose} style={{width:34,alignItems:'center'}}><Icon name="close" size={19}/></Tap></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingHorizontal:18,paddingBottom:18,gap:12}}>{children}</ScrollView></View></KeyboardAvoidingView></OverlayModal>;
}
