import React from 'react';
import {View,Linking} from 'react-native';
import {contactProfiles,openSocialProfile,type SocialProfiles} from '../api/social-profiles';
import type {Conversation} from '../api/types';
import {channels} from '../api/types';
import {useApp} from '../store/app';
import {useTheme} from '../theme';
import {t} from '../i18n/engine';
import {Tap,T,Icon} from './ui';

export function SocialProfileLinks({contact,conversation}:{contact?:{phone?:string|null;social_profiles?:SocialProfiles}|null;conversation?:Conversation}){
 const c=useTheme();const notify=useApp(s=>s.notify);const profiles=contactProfiles(contact,conversation);
 const unavailable=conversation&&['facebook','instagram'].includes(conversation.channel)&&!profiles.some(p=>p.channel===conversation.channel);
 return <View style={{gap:6}}>{profiles.map(profile=><Tap key={profile.channel} testID={'contact-profile-'+profile.channel} label={t('contact.openProfile',{channel:channels[profile.channel]})} onPress={()=>void openSocialProfile(profile,url=>Linking.openURL(url)).then(ok=>{if(!ok)notify(t('contact.profileOpenError'))})} style={{flexDirection:'row',justifyContent:'flex-start',gap:10,paddingVertical:6}}><Icon name={profile.channel==='whatsapp'?'phone':profile.channel} size={20} color={c.blue}/><View style={{flex:1}}><T bold size={12} color={c.blue}>{t('contact.openProfile',{channel:channels[profile.channel]})}</T><T size={11} muted numberOfLines={1}>{profile.handle}</T></View><Icon name="open-outline" size={17} color={c.soft}/></Tap>)}{unavailable&&<T size={11} muted>{t('contact.profileUnavailable',{channel:channels[conversation.channel]})}</T>}</View>;
}
