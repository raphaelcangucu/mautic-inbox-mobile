import React,{useState} from 'react';
import {View} from 'react-native';
import {Card,Icon,T,Tap} from './ui';
import {Sheet} from './Sheet';
import {useTheme} from '../theme';
import {t} from '../i18n/engine';
import {useLanguage,setLanguagePreference} from '../i18n/preferences';
import type {LanguagePreference} from '../i18n/language';
import {useApp} from '../store/app';

export function LanguageSelector(){
  const c=useTheme();const {preference}=useLanguage();
  const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);
  const choices:readonly [LanguagePreference,string][]=[['system',t('preferences.system')],['pt-BR','Português (Brasil)'],['en','English'],['es','Español']];
  const label=choices.find(([key])=>key===preference)![1];
  async function choose(value:LanguagePreference){
    if(busy)return;setBusy(true);
    try{await setLanguagePreference(value);setOpen(false)}
    catch{useApp.getState().notify(t('preferences.languageError'))}
    finally{setBusy(false)}
  }
  return <>
    <Card><Tap testID="language-selector" label={t('preferences.language')+': '+label} onPress={()=>setOpen(true)} style={{flexDirection:'row',gap:10}}>
      <Icon name="globe-outline" color={c.blue}/><View style={{flex:1}}><T bold size={13}>{t('preferences.language')}</T><T size={11} muted>{label}</T></View><Icon name="chevron-forward" size={16}/>
    </Tap></Card>
    <Sheet title={t('preferences.language')} visible={open} onClose={()=>{if(!busy)setOpen(false)}}>
      <T size={12} muted>{t('preferences.languageHint')}</T>
      {choices.map(([key,name])=><Tap key={key} testID={'language-'+key} label={name} disabled={busy} onPress={()=>void choose(key)} style={{flexDirection:'row',gap:10,paddingVertical:8}}>
        <T size={13} bold={preference===key} style={{flex:1}}>{name}</T>{preference===key&&<Icon name="checkmark" size={18} color={c.blue}/>}</Tap>)}
    </Sheet>
  </>;
}
