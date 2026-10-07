import {t} from '../i18n/engine.ts';
import React,{useEffect,useRef,useState} from 'react';
import {View,Image,AppState,Alert,Platform} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {useApp} from '../store/app';
import {useTheme} from '../theme';
import {Button,T,Card} from './ui';
import {Sheet} from './Sheet';
import {QrRequestLane} from '../api/qr-request-lane';
import {pairingFromApi,pairingLabel,qrImageCurrent,type QrConnection,type QrPairing} from '../api/whatsqr';

/** Pairing material is ephemeral: never stored in the account's history/cache. */
export function WhatsQrConnections(){
 const s=useApp();const c=useTheme();const [open,setOpen]=useState(false);const [connections,setConnections]=useState<QrConnection[]>([]);const [selected,setSelected]=useState<QrConnection|null>(null);const [detail,setDetail]=useState<QrPairing|null>(null);const [receivedAt,setReceivedAt]=useState(0);const [foreground,setForeground]=useState(AppState.currentState==='active');const [busy,setBusy]=useState(false);const [sharing,setSharing]=useState(false);const [error,setError]=useState('');const [actionError,setActionError]=useState('');const epoch=useRef(0);const lane=useRef(new QrRequestLane());const sharingNow=useRef(false);
 const account=s.active?.id;const repo=s.repo;const folder=FileSystem.cacheDirectory?FileSystem.cacheDirectory+'whatsqr-share/':null;
 function clear(){epoch.current++;setDetail(null);setReceivedAt(0);setBusy(false);setActionError('')}
 useEffect(()=>{clear();setOpen(false);setSelected(null);setConnections([]);setError('')},[account]);
 useEffect(()=>{const listener=AppState.addEventListener('change',state=>{setForeground(state==='active');if(state!=='active')clear()});return()=>{epoch.current++;listener.remove()}},[]);
 useEffect(()=>{if(s.offline)clear()},[s.offline]);
 useEffect(()=>{if(!detail?.image_base64||!receivedAt)return;const timer=setTimeout(()=>setDetail(null),Math.max(0,receivedAt+30000-Date.now()));return()=>clearTimeout(timer)},[detail?.version,receivedAt]);
 useEffect(()=>{if(folder)void FileSystem.deleteAsync(folder,{idempotent:true}).catch(()=>{})},[]);
 const valid=(generation:number)=>generation===epoch.current&&useApp.getState().active?.id===account;
 async function list(){if(!repo||s.offline)return;const generation=++epoch.current;setOpen(true);setSelected(null);setDetail(null);setConnections([]);setBusy(true);setError('');try{const data=await repo.api.request<{items:QrConnection[]}>({method:'GET',path:'/inbox/mobile/whatsqr'});if(valid(generation))setConnections(data.items)}catch(e){if(valid(generation))setError(e instanceof Error?e.message:String(e))}finally{if(valid(generation))setBusy(false)}}
 async function fetchStatus(id:number){if(!repo)throw Error(t("qr.signIn"));return pairingFromApi(await repo.api.request<QrPairing>({method:'GET',path:`/inbox/mobile/whatsqr/${id}`}),id)}
 useEffect(()=>{
  if(!open||!selected||!foreground||s.offline)return;let stopped=false;let timer:ReturnType<typeof setTimeout>;const generation=epoch.current;
  async function poll(){if(stopped)return;if(sharingNow.current){timer=setTimeout(()=>void poll(),5000);return}try{const fresh=await lane.current.poll(()=>fetchStatus(selected!.id));if(fresh&&!stopped&&valid(generation)){setDetail(fresh);setReceivedAt(Date.now());setError('')}}catch(e){if(!stopped&&valid(generation)){setDetail(null);setError(e instanceof Error?e.message:String(e))}}finally{if(!stopped)timer=setTimeout(()=>void poll(),5000)}}
  void poll();return()=>{stopped=true;clearTimeout(timer)};
 },[open,selected?.id,foreground,s.offline,account]);
 async function start(regenerate=false){if(!repo||!selected||busy||sharing||s.offline)return;const generation=epoch.current;const id=selected.id;setBusy(true);setDetail(null);setActionError('');try{const fresh=await lane.current.action(async()=>{if(!valid(generation))return null;return pairingFromApi(await repo.api.request<QrPairing>({method:'POST',path:`/inbox/mobile/whatsqr/${id}/start`,body:{regenerate}}),id)});if(fresh&&valid(generation)){setDetail(fresh);setReceivedAt(Date.now());setError('')}}catch(e){if(valid(generation))setActionError(e instanceof Error?e.message:String(e))}finally{if(valid(generation))setBusy(false)}}
 async function share(){if(!selected||sharingNow.current||busy||s.offline)return;const generation=epoch.current;const id=selected.id;let file:string|null=null;sharingNow.current=true;setSharing(true);setActionError('');try{await lane.current.action(async()=>{
   if(Platform.OS==='web'||!folder||!await Sharing.isAvailableAsync())throw Error(t("qr.shareUnavailable"));
   if(!valid(generation))return;const fresh=await fetchStatus(id);if(!valid(generation))return;setDetail(fresh);setReceivedAt(Date.now());if(!qrImageCurrent(fresh,Date.now()))throw Error(t("qr.noCode"));
   await FileSystem.makeDirectoryAsync(folder,{intermediates:true});file=folder+'whatsapp-qr-'+id+'-'+Date.now()+'.png';await FileSystem.writeAsStringAsync(file,fresh.image_base64!,{encoding:FileSystem.EncodingType.Base64});
   if(!valid(generation))return;await Sharing.shareAsync(file,{mimeType:'image/png',UTI:'public.png',dialogTitle:t("qr.shareTitle")});
  });}catch(e){if(valid(generation)){setDetail(null);setActionError(e instanceof Error?e.message:String(e))}}finally{if(file)await FileSystem.deleteAsync(file,{idempotent:true}).catch(()=>{});sharingNow.current=false;setSharing(false)}
 }
 function close(){clear();setOpen(false);setSelected(null);setError('')}
 const current=qrImageCurrent(detail,receivedAt)&&foreground&&!s.offline;
 return <><Button quiet label={t("qr.title")} testID="whatsqr-connections" disabled={!repo||s.offline} onPress={()=>void list()}/><Sheet title={selected?t("qr.connectTitle"):t("qr.connections")} visible={open} onClose={close}>
 {!selected?<>{connections.map(connection=><Button quiet key={connection.id} label={connection.name} disabled={!connection.can_pair} testID={'whatsqr-asset-'+connection.id} onPress={()=>{clear();setSelected(connection);setError('')}}/>)}{!busy&&!connections.length&&!error&&<T muted size={12}>{t("qr.noNumbers")}</T>}</>:<>
 <T bold size={16}>{selected.name}</T><T size={12} muted>{s.active?.name} · {s.active?.origin.replace('https://','')}</T>{detail&&<T bold size={13} testID="whatsqr-status">{pairingLabel(detail)}</T>}
 {current?<View style={{alignItems:'center',gap:10}}><Image accessibilityLabel={t("qr.imageLabel")} testID="whatsqr-image" onError={()=>{setDetail(null);setError(t("qr.imageError"))}} source={{uri:'data:image/png;base64,'+detail!.image_base64}} resizeMode="contain" style={{width:'100%',maxWidth:320,aspectRatio:1,backgroundColor:'#FFFFFF',borderRadius:0}}/><T muted size={11}>{t("qr.autoRefresh")}</T><Button label={sharing?t("qr.sharing"):t("qr.shareImage")} testID="whatsqr-share" disabled={sharing||busy} onPress={()=>void share()}/></View>:detail?.stage==='waiting'?<T muted size={12}>{t("qr.waitingRefresh")}</T>:null}
 {detail?.can_start&&<Button label={t("qr.generate")} disabled={busy||sharing||s.offline} testID="whatsqr-start" onPress={()=>void start()}/>}
 {detail?.can_regenerate&&<Button label={t("qr.generateAnother")} disabled={busy||sharing||s.offline} onPress={()=>Alert.alert(t("qr.generateConfirm"),t("qr.replaceHint"),[{text:t("common.cancel"),style:'cancel'},{text:t("qr.generate"),onPress:()=>void start(true)}])}/>}
 <Card><T bold size={12}>{t("qr.howTo")}</T><T muted size={12}>{t("qr.instructions")}</T><T muted size={11}>{t("qr.shareHint")}</T></Card><Button quiet label={t("qr.backNumbers")} disabled={sharing} onPress={()=>{clear();setSelected(null);setError('')}}/>
 </>}{(busy||(selected&&!detail&&!error&&!actionError))&&<T muted size={12}>{t("qr.querying")}</T>}{(actionError||error)&&<T size={12} color={c.warn} accessibilityRole="alert">{actionError||error}</T>}{s.offline&&<T muted size={12}>{t("qr.offline")}</T>}
 </Sheet></>;
}
