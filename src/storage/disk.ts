import {t} from '../i18n/engine.ts';
import {Platform} from 'react-native';
import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import type {Storage} from './interface';

export async function accountHash(id: string){return (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,id)).slice(0,40)}
export async function deleteAccountDisk(id:string){const hash=await accountHash(id);if(Platform.OS!=='web'){await FileSystem.deleteAsync(FileSystem.cacheDirectory+'inbox-media-'+id+'/',{idempotent:true});await SQLite.deleteDatabaseAsync('mautic-demo-'+hash+'.db');await SecureStore.deleteItemAsync('mautic_cache_key_'+hash)}}
export async function openDisk(accountId: string): Promise<Storage> {
  const hash=await accountHash(accountId);
  if(Platform.OS==='web'){
    const prefix='mautic-demo-'+hash+':';
    // Browser preview only. Native storage is SQLCipher; this is never a production auth adapter.
    return {get:async k=>{const v=localStorage.getItem(prefix+k);return v?JSON.parse(v):null},put:async(k,v)=>{localStorage.setItem(prefix+k,JSON.stringify(v))},remove:async k=>{localStorage.removeItem(prefix+k)},scan:async p=>Object.keys(localStorage).filter(k=>k.startsWith(prefix+p)).map(k=>JSON.parse(localStorage.getItem(k)!)),clear:async()=>{Object.keys(localStorage).filter(k=>k.startsWith(prefix)).forEach(k=>localStorage.removeItem(k))},close:async()=>{}};
  }
  const keyId='mautic_cache_key_'+hash;
  let key=await SecureStore.getItemAsync(keyId);
  if(!key){key=Array.from(await Crypto.getRandomBytesAsync(32)).map(n=>n.toString(16).padStart(2,'0')).join('');await SecureStore.setItemAsync(keyId,key,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY})}
  if(!/^[a-f0-9]{64}$/.test(key))throw new Error(t("storage.invalidKey"));
  const db=await SQLite.openDatabaseAsync('mautic-demo-'+hash+'.db');
  await db.execAsync(`PRAGMA key = '${key}';`);
  const cipher=await db.getFirstAsync<Record<string,string>>('PRAGMA cipher_version;');
  if(!cipher||!Object.values(cipher)[0])throw new Error(t("storage.cipherUnavailable"));
  await db.execAsync('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records (key TEXT PRIMARY KEY NOT NULL,value TEXT NOT NULL); PRAGMA user_version=1;');
  await db.runAsync('INSERT OR REPLACE INTO records(key,value) VALUES(?,?)','diagnostics:cipher',JSON.stringify(Object.values(cipher)[0]));
  return {
    get:async k=>{const row=await db.getFirstAsync<{value:string}>('SELECT value FROM records WHERE key=?',k);return row?JSON.parse(row.value):null},
    put:async(k,v)=>{await db.runAsync('INSERT OR REPLACE INTO records(key,value) VALUES(?,?)',k,JSON.stringify(v))},
    remove:async k=>{await db.runAsync('DELETE FROM records WHERE key=?',k)},
    scan:async p=>(await db.getAllAsync<{value:string}>('SELECT value FROM records WHERE key>=? AND key<? ORDER BY key',p,p+'\uffff')).map(r=>JSON.parse(r.value)),
    clear:async()=>{await db.execAsync('DELETE FROM records; PRAGMA wal_checkpoint(TRUNCATE);')},
    close:async()=>{await db.closeAsync()},
  };
}
