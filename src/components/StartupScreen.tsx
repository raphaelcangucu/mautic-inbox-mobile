import {t} from '../i18n/engine';
import React from 'react';
import {Image,Text,View} from 'react-native';
import {dark,light,font} from '../theme';

/** Mirrors the native launch mark while fonts and the local account cache hydrate. */
export function StartupScreen({theme,fontsReady=true}:{theme:'light'|'dark';fontsReady?:boolean}){
 const c=theme==='dark'?dark:light;
 return <View testID="app-startup" accessibilityLabel={t("startup.opening")} style={{flex:1,backgroundColor:c.canvas,alignItems:'center',justifyContent:'center'}}>
  <Image source={require('../../assets/icon.png')} accessibilityIgnoresInvertColors style={{width:88,height:88}}/>
  {fontsReady&&<Text style={{position:'absolute',top:'50%',marginTop:64,fontFamily:font.bold,fontSize:20,lineHeight:28,color:c.ink}}>Mautic Inbox</Text>}
 </View>
}
