import React,{useEffect,useRef,useState,useImperativeHandle,forwardRef} from 'react';
import {AppState,Keyboard,Platform,TextInput,View} from 'react-native';
import {AudioModule,RecordingPresets,setAudioModeAsync,useAudioRecorder,useAudioRecorderState,useAudioPlayer,useAudioPlayerStatus} from 'expo-audio';
import * as Files from 'expo-file-system/legacy';
import {t,currentLanguage,type TranslationKey} from '../i18n/engine';
import {useTheme,font} from '../theme';
import {T,Tap,Icon,Button} from './ui';
import {Sheet} from './Sheet';
import {transcribe,stopDictation,type SpeechFailure} from '../voice/speech';
import {fileTranscriptionSupported} from '../voice/transcript';
import type {Attachment} from '../api/types';

type Phase='idle'|'preparing'|'recording'|'stopping'|'review'|'transcribing'|'dictating';
export type VoiceHandle={open:()=>void};
function Preview({uri,disabled,onError}:{uri:string;disabled:boolean;onError:()=>void}){
 const player=useAudioPlayer(uri);const status=useAudioPlayerStatus(player);const c=useTheme();
 useEffect(()=>{if(disabled)player.pause()},[disabled,player]);
 return <View style={{flexDirection:'row',alignItems:'center',gap:12}}><Tap testID="voice-play" disabled={disabled} label={t(status.playing?'voice.pause':'voice.listen')} onPress={()=>{if(status.playing)player.pause();else void(async()=>{if(status.didJustFinish)await player.seekTo(0);player.play()})().catch(onError)}} style={{width:44,height:44,borderRadius:14,backgroundColor:c.tint,alignItems:'center'}}><Icon name={status.playing?'pause':'play'} size={19} color={c.blue}/></Tap><T size={12} muted>{Math.floor(status.currentTime)} / {Math.ceil(status.duration)} s</T></View>
}
export const VoiceComposer=forwardRef<VoiceHandle,{disabled?:boolean;audioAllowed?:boolean;onText:(text:string)=>void;onAudio?:(attachment:Attachment,valid:()=>boolean)=>void|Promise<void>;onBusy?:(value:boolean)=>void}>((props,ref)=>{
 const c=useTheme();const recorder=useAudioRecorder({...RecordingPresets.HIGH_QUALITY,sampleRate:44100,numberOfChannels:1,bitRate:64000});
 const state=useAudioRecorderState(recorder,200);
 const [visible,setVisible]=useState(false),[phase,setPhase]=useState<Phase>('idle'),[uri,setUri]=useState(''),[duration,setDuration]=useState(0),[text,setText]=useState(''),[error,setError]=useState('');
 const alive=useRef(true),epoch=useRef(0),owned=useRef(''),phaseRef=useRef<Phase>('idle'),cancelSpeech=useRef<()=>void>(()=>{}),started=useRef(0),observedRecording=useRef(false),capturePending=useRef(false);
 const currentProps=useRef(props);currentProps.current=props;
 const change=(next:Phase)=>{phaseRef.current=next;setPhase(next);currentProps.current.onBusy?.(!['idle','review'].includes(next))};
 const remove=(file:string)=>{if(file)void Files.deleteAsync(file,{idempotent:true}).catch(()=>{})};
 const cancel=()=>{++epoch.current;cancelSpeech.current();cancelSpeech.current=()=>{};if(phaseRef.current==='recording'){const file=recorder.uri;capturePending.current=true;void recorder.stop().then(()=>{remove(file||recorder.uri||'');return setAudioModeAsync({allowsRecording:false})}).catch(()=>{}).finally(()=>{capturePending.current=false})}remove(owned.current);owned.current='';setUri('');setText('');setError('');change('idle');setVisible(false)};
 useImperativeHandle(ref,()=>({open:()=>{if(currentProps.current.disabled||capturePending.current)return;Keyboard.dismiss();setVisible(true)}}));
 useEffect(()=>{alive.current=true;const listener=AppState.addEventListener('change',value=>{if(value==='background'||value==='inactive'&&['recording','transcribing','dictating'].includes(phaseRef.current))cancel()});return()=>{alive.current=false;++epoch.current;cancelSpeech.current();listener.remove();remove(owned.current);if(['recording','preparing','stopping'].includes(phaseRef.current))void recorder.stop().then(()=>remove(recorder.uri||'')).catch(()=>{});void setAudioModeAsync({allowsRecording:false}).catch(()=>{});currentProps.current.onBusy?.(false)}},[]);
 async function finish(){
  if(phaseRef.current!=='recording')return;capturePending.current=true;change('stopping');const token=epoch.current;
  try{await recorder.stop();const file=recorder.uri;if(!file)throw Error();await setAudioModeAsync({allowsRecording:false});if(!alive.current||token!==epoch.current){remove(file);return}
   const elapsed=Math.max(state.durationMillis,Date.now()-started.current);if(elapsed<500){remove(file);setError(t('voice.tooShort'));change('idle');return}
   owned.current=file;setUri(file);setDuration(elapsed);change('review');
  }catch{if(alive.current&&token===epoch.current){change('idle');setError(t('voice.recordError'))}}finally{capturePending.current=false}
 }
 useEffect(()=>{if(state.isRecording)observedRecording.current=true;if(state.isRecording&&state.durationMillis>=180000)void finish();if(observedRecording.current&&phaseRef.current==='recording'&&!state.isRecording)void finish()},[state.isRecording,state.durationMillis]);
 async function record(){
  if(phaseRef.current!=='idle'||capturePending.current)return;capturePending.current=true;change('preparing');setError('');setText('');const token=++epoch.current;
  try{const permission=await AudioModule.requestRecordingPermissionsAsync();if(!alive.current||token!==epoch.current)return;if(!permission.granted){setError(t('voice.micPermission'));change('idle');return}
   await setAudioModeAsync({allowsRecording:true,playsInSilentMode:true});if(!alive.current||token!==epoch.current){await setAudioModeAsync({allowsRecording:false});return}
   await recorder.prepareToRecordAsync();if(!alive.current||token!==epoch.current){await recorder.stop();remove(recorder.uri||'');return}
   started.current=Date.now();observedRecording.current=false;recorder.record();change('recording');
  }catch{if(alive.current&&token===epoch.current){change('idle');setError(t('voice.recordError'));void setAudioModeAsync({allowsRecording:false}).catch(()=>{})}}finally{capturePending.current=false}
 }
 const speechError=(reason:SpeechFailure)=>{setError(t(('voice.error.'+reason) as TranslationKey));change(uri?'review':'idle')};
 async function recognize(file?:string){
  if(!['idle','review'].includes(phaseRef.current))return;setError('');setText('');change('preparing');const token=++epoch.current;
  const valid=()=>alive.current&&token===epoch.current;
  const cleanup=await transcribe({uri:file,language:currentLanguage(),valid,onReady:()=>change(file?'transcribing':'dictating'),onText:value=>setText(value),onEnd:()=>change(file?'review':'idle'),onError:speechError});
  if(valid())cancelSpeech.current=cleanup;else cleanup();
 }
 function useText(){try{props.onText(text);cancel()}catch{setError(t('voice.textTooLong'))}}
 async function useAudio(){
  if(!props.audioAllowed||!props.onAudio||!uri||phaseRef.current!=='review')return;
  change('preparing');const token=epoch.current;const valid=()=>alive.current&&token===epoch.current;try{const info=await Files.getInfoAsync(uri);if(!alive.current||token!==epoch.current)return;
  if(!info.exists||!('size' in info)||info.size<=0){setError(t('voice.recordError'));change('review');return}
  // The parent copies the recording into the account's durable outbox storage.
  const attachment:Attachment={name:t('chat.voiceFilename'),uri,mime:'audio/mp4',duration,size:info.size};await props.onAudio(attachment,valid);if(!alive.current||token!==epoch.current)return;cancel()}catch(e){if(valid()){change('review');setError(t(e instanceof Error&&e.message==='audio_with_draft'?'voice.audioWithDraft':'voice.recordError'))}}
 }
 const active=!['idle','review'].includes(phase);
 return <Sheet title={t('voice.title')} visible={visible} onClose={cancel}>
  {phase==='recording'||phase==='stopping'?<View style={{gap:12}}><View style={{flexDirection:'row',alignItems:'center',gap:10}}><Icon name="mic-outline" size={24} color={c.warn}/><T bold>{t('voice.recording',{seconds:Math.floor(state.durationMillis/1000)})}</T></View><T size={11} muted>{t('voice.limit')}</T><Button testID="voice-stop" disabled={phase==='stopping'} label={t('voice.stop')} onPress={()=>void finish()}/></View>:
   <>{uri&&<Preview uri={uri} disabled={active} onError={()=>setError(t('voice.recordError'))}/>}<T size={11} muted>{t('voice.systemNotice')}</T>
    {text&&<TextInput testID="voice-transcript" accessibilityLabel={t('voice.transcript')} multiline value={text} onChangeText={setText} editable={!active} maxLength={4000} style={{minHeight:90,maxHeight:190,padding:12,borderRadius:14,backgroundColor:c.canvas,color:c.ink,fontFamily:font.regular,fontSize:15,lineHeight:22,textAlignVertical:'top'}}/>}
    {active?<><T testID="voice-progress" size={12}>{t(phase==='transcribing'?'voice.transcribing':phase==='dictating'?'voice.dictating':'voice.preparing')}</T>{phase==='dictating'&&<Button label={t('voice.stopDictation')} onPress={stopDictation}/>}</>:
     <>{!uri&&<Button testID="voice-record" label={t('voice.record')} onPress={()=>void record()}/>}{!uri&&<Button quiet testID="voice-dictate" label={t('voice.dictate')} onPress={()=>void recognize()}/>}{uri&&fileTranscriptionSupported(Platform.OS,Platform.Version)&&<Button quiet testID="voice-transcribe" label={t('voice.transcribe')} onPress={()=>void recognize(uri)}/>}{uri&&!fileTranscriptionSupported(Platform.OS,Platform.Version)&&<T size={11} muted>{t('voice.error.unsupported')}</T>}{!!text.trim()&&<Button testID="voice-use-text" label={t('voice.useText')} onPress={useText}/>} {uri&&props.audioAllowed&&<Button testID="voice-use-audio" label={t('voice.useAudio')} onPress={()=>void useAudio()}/>} {uri&&!props.audioAllowed&&<T size={11} muted>{t('voice.audioUnavailable')}</T>}</>}
   </>}
  {error&&<T accessibilityRole="alert" testID="voice-error" size={12} color={c.warn}>{error}</T>}
  <Button quiet testID="voice-discard" label={t('voice.discard')} onPress={cancel}/>
 </Sheet>
});
