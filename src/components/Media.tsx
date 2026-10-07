import {t} from '../i18n/engine.ts';
import React,{useState,useEffect} from 'react';
import {View,Image,Platform} from 'react-native';
import {useAudioPlayer,useAudioPlayerStatus} from 'expo-audio';
import {useVideoPlayer,VideoView} from 'expo-video';
import {Asset} from 'expo-asset';
import {useEvent} from 'expo';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import {HttpTransport} from '../api/http';
import {type Attachment} from '../api/types';
import {useApp} from '../store/app';
import {useTheme} from '../theme';
import {Button,T,Tap} from './ui';
import {Sheet} from './Sheet';
const media={image:require('../../assets/avatars/ricardo.png'),audio:require('../../assets/media/demo_audio.wav'),video:require('../../assets/media/demo_video.mp4'),document:require('../../assets/media/demo_document.pdf')};
function AudioPreview({source,onError}:{source:any;onError:()=>void}){const player=useAudioPlayer(source);const status=useAudioPlayerStatus(player);async function toggle(){try{if(status.playing)player.pause();else{if(status.didJustFinish)await player.seekTo(0);player.play()}}catch{onError()}}return <View style={{gap:6}}><Button quiet label={status.playing?t("media.pauseAudio"):t("media.playAudio")} onPress={()=>void toggle()}/><T size={10} muted>{Math.floor(status.currentTime)}s / {Math.floor(status.duration)}s</T></View>}
function VideoPreview({source,onError}:{source:any;onError:()=>void}){const player=useVideoPlayer(source);const playing=useEvent(player,'playingChange',{isPlaying:player.playing});const status=useEvent(player,'statusChange',{status:player.status});useEffect(()=>{if(status.status==='error')onError()},[status.status]);return <View style={{gap:7}}><VideoView player={player} nativeControls style={{width:'100%',height:150,borderRadius:10}}/><Button quiet label={playing.isPlaying?t("media.pauseVideo"):t("media.playVideo")} onPress={()=>{try{if(player.playing)player.pause();else{if(player.currentTime>=player.duration-.05)player.currentTime=0;player.play()}}catch{onError()}}}/></View>}
export function Media({attachment:a}:{attachment:Attachment}){
 const c=useTheme();const [zoom,setZoom]=useState(false);const [failed,setFailed]=useState(false);const [retry,setRetry]=useState(0);const transport=useApp(st=>st.transport);const accountId=useApp(st=>st.active?.id);const [remote,setRemote]=useState<{uri:string;headers?:Record<string,string>}|null>(null);const source=a.demoKey?media[a.demoKey]:remote;
 useEffect(()=>{let alive=true;setRemote(null);if(a.uri){if(transport instanceof HttpTransport)void transport.mediaSource(a.uri).then(value=>{if(alive)setRemote(value)}).catch(()=>{if(alive)setFailed(true)});else setRemote({uri:a.uri})}return()=>{alive=false}},[a.uri,accountId,retry]);
 useEffect(()=>{setFailed(false)},[a.uri,a.demoKey,retry]);
 async function openDocument(){try{if(!source)throw new Error(t("media.fileUnavailable"));const asset=typeof source==='number'?Asset.fromModule(source):null;if(asset)await asset.downloadAsync();let uri=asset?.localUri||asset?.uri||a.uri!;if(!asset&&typeof source==='object'){uri=source.uri;if(Platform.OS!=='web'&&/^https:/.test(uri)){const directory=FileSystem.cacheDirectory+'inbox-media-'+accountId+'/';await FileSystem.makeDirectoryAsync(directory,{intermediates:true});const result=await FileSystem.downloadAsync(uri,directory+encodeURIComponent(a.name),{headers:source.headers});if(result.status!==200)throw Error(t("media.documentFailed"));uri=result.uri}}if(Platform.OS==='web')window.open(asset?.uri||uri,'_blank','noopener,noreferrer');else if(await Sharing.isAvailableAsync())await Sharing.shareAsync(uri,{mimeType:a.mime,dialogTitle:a.name});else throw new Error(t("media.shareUnavailable"))}catch(e){setFailed(true);useApp.getState().notify(String(e))}}
 return <View style={{paddingTop:8,gap:7,width:a.mime.startsWith('image')?190:undefined}}><T size={11} bold>{a.name}</T>{a.demoKey&&<T size={9} muted>{t("media.demo")}</T>}{failed?<Button quiet label={t("media.retry")} onPress={()=>{setRetry(retry+1);}}/>:!source?<T size={11} muted>{t("media.noPreview")}</T>:a.mime.startsWith('image')?<><Tap label={t("media.enlarge")} onPress={()=>setZoom(true)}><Image key={retry} source={source} onError={()=>setFailed(true)} style={{width:190,height:130,borderRadius:12,backgroundColor:c.raised}} resizeMode="cover"/></Tap><Sheet title={a.name} visible={zoom} onClose={()=>setZoom(false)}><Image source={source} style={{width:'100%',height:350}} resizeMode="contain"/></Sheet></>:a.mime.startsWith('audio')?<AudioPreview source={source} onError={()=>setFailed(true)}/>:a.mime.startsWith('video')?<VideoPreview source={source} onError={()=>setFailed(true)}/>:<Button quiet label={t("media.openDocument")} onPress={()=>void openDocument()}/>}</View>;
}
