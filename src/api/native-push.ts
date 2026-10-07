import {t} from '../i18n/engine.ts';
import {Platform,AppState} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import type {Account,Preferences,Transport} from './types';
import {currentLanguage} from '../i18n/engine';
export type PushStatus={registered:boolean;configured:boolean;enabled:boolean;environment:string|null;last_accepted_at:string|null;last_error:string|null};
let installationPromise:Promise<string>|undefined;
let deviceToken:string|undefined;
let tokenRequest:Promise<Notifications.DevicePushToken>|undefined;
async function currentToken(){let timer:ReturnType<typeof setTimeout>|undefined;try{tokenRequest??=Notifications.getDevicePushTokenAsync().finally(()=>{tokenRequest=undefined});return await Promise.race([tokenRequest,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error(t("push.tokenPending"))),15000)})])}finally{if(timer)clearTimeout(timer)}}
export async function installation(){return installationPromise??=(async()=>{let id=await SecureStore.getItemAsync('mautic_push_installation_v1');if(!id){id=Crypto.randomUUID();await SecureStore.setItemAsync('mautic_push_installation_v1',id,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY})}return id})()}
export function updateNativeToken(token:Notifications.DevicePushToken){if(token.type==='ios'&&typeof token.data==='string')deviceToken=token.data}
export async function permissionGranted(){const p=await Notifications.getPermissionsAsync();return p.granted||p.ios?.status===Notifications.IosAuthorizationStatus.PROVISIONAL}
export async function registerNativePush(api:Transport,account:Account,preferences:Preferences,openConversation:number,foreground=AppState.currentState==='active'):Promise<PushStatus>{
 if(Platform.OS!=='ios')throw new Error(t("push.iosOnly"));
 if(!await permissionGranted())throw new Error(t("push.allowSettings"));
 if(!deviceToken)updateNativeToken(await currentToken());
 if(!deviceToken)throw new Error(t("push.registerPending"));
 const environment=Constants.expoConfig?.extra?.apnsEnvironment;
 if(environment!=='development'&&environment!=='production')throw new Error(t("push.missingEnvironment"));
 return api.request<PushStatus>({method:'PUT',path:'/inbox/mobile/push/device',body:{installation:await installation(),token:deviceToken,environment,bundle:Constants.expoConfig?.ios?.bundleIdentifier,accountId:account.id,name:account.name,locale:currentLanguage(),preferences:{...preferences,enabled:preferences.remotePush===true},openConversation,foreground}});
}
export async function nativePushStatus(api:Transport){return api.request<PushStatus>({method:'GET',path:'/inbox/mobile/push/device',query:{installation:await installation()}})}
export async function removeNativePush(api:Transport){return api.request({method:'DELETE',path:'/inbox/mobile/push/device',body:{installation:await installation()}})}
export async function testNativePush(api:Transport){return api.request({method:'POST',path:'/inbox/mobile/push/test',body:{installation:await installation()}})}
export async function activateNativePush(){const permission=await Notifications.requestPermissionsAsync();if(!permission.granted&&permission.ios?.status!==Notifications.IosAuthorizationStatus.PROVISIONAL)throw new Error(t("push.allowSettings"));deviceToken=undefined;}
export function refreshNativeToken(){deviceToken=undefined}
