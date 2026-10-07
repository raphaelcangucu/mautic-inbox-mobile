import * as Crypto from 'expo-crypto';
import type {Storage} from './interface';
export async function accountHash(id:string){return (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,id)).slice(0,40)}
export async function deleteAccountDisk(id:string){const prefix='mautic-demo-'+await accountHash(id)+':';Object.keys(localStorage).filter(k=>k.startsWith(prefix)).forEach(k=>localStorage.removeItem(k))}
export async function openDisk(id:string):Promise<Storage>{const prefix='mautic-demo-'+await accountHash(id)+':';return {
  get:async key=>{const raw=localStorage.getItem(prefix+key);return raw?JSON.parse(raw):null},
  put:async(key,value)=>{localStorage.setItem(prefix+key,JSON.stringify(value))},
  remove:async key=>{localStorage.removeItem(prefix+key)},
  scan:async p=>Object.keys(localStorage).filter(k=>k.startsWith(prefix+p)).map(k=>JSON.parse(localStorage.getItem(k)!)),
  clear:async()=>{Object.keys(localStorage).filter(k=>k.startsWith(prefix)).forEach(k=>localStorage.removeItem(k))},
  close:async()=>{},
}}
