// Account vault adapted from Civitas; native real sessions remain in SecureStore.
import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {accountHash} from './disk';
import type {Session} from '../api/types';
export async function saveSession(id: string,value: Session){const key='mautic_session_'+await accountHash(id);if(Platform.OS==='web')localStorage.setItem(key,JSON.stringify(value));else await SecureStore.setItemAsync(key,JSON.stringify(value),{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY})}
export async function readSession(id: string):Promise<Session|null>{const key='mautic_session_'+await accountHash(id);const raw=Platform.OS==='web'?localStorage.getItem(key):await SecureStore.getItemAsync(key);try{return raw?JSON.parse(raw):null}catch{return null}}
export async function deleteSession(id: string){const key='mautic_session_'+await accountHash(id);if(Platform.OS==='web')localStorage.removeItem(key);else await SecureStore.deleteItemAsync(key)}
