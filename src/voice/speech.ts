import {Platform} from 'react-native';
import {ExpoSpeechRecognitionModule as native} from 'expo-speech-recognition';
import {Transcript,speechLocale,fileTranscriptionSupported} from './transcript';

let owner:symbol|null=null;
export type SpeechFailure='permission'|'unavailable'|'unsupported'|'noSpeech'|'network'|'interrupted'|'failed'|'timeout';
/** A single native recognizer; no raw audio or transcript is logged or sent to our API here. */
export async function transcribe(options:{uri?:string;language:string;valid:()=>boolean;onReady?:()=>void;onText:(text:string)=>void;onEnd:()=>void;onError:(reason:SpeechFailure)=>void}){
 if(owner){options.onError('failed');return ()=>{}}
 const id=Symbol('speech');owner=id;
 const valid=()=>owner===id&&options.valid();
 let listeners:{remove:()=>void}[]=[];
 let timer:ReturnType<typeof setTimeout>|undefined;
 const release=()=>{if(timer)clearTimeout(timer);listeners.forEach(listener=>listener.remove());listeners=[];if(owner===id)owner=null};
 const cancel=()=>{if(owner!==id)return;release();native.abort()};
 try{
  if(options.uri&&!fileTranscriptionSupported(Platform.OS,Platform.Version)){release();if(options.valid())options.onError('unsupported');return ()=>{}}
  if(!native.isRecognitionAvailable()){release();if(options.valid())options.onError('unavailable');return ()=>{}}
  const permission=options.uri&&Platform.OS==='ios'?await native.requestSpeechRecognizerPermissionsAsync():await native.requestPermissionsAsync();
  if(!valid()){cancel();return ()=>{}}
  if(!permission.granted){release();options.onError('permission');return ()=>{}}
  const accumulator=new Transcript(Platform.OS==='ios');let received='';
  listeners=[native.addListener('result',event=>{if(!valid())return;received=accumulator.update(event.results[0]?.transcript||'',event.isFinal);options.onText(received)}),
   native.addListener('error',event=>{if(!valid())return;const reason:SpeechFailure=event.error==='no-speech'||event.error==='speech-timeout'?'noSpeech':event.error==='network'?'network':event.error==='not-allowed'?'permission':event.error==='interrupted'?'interrupted':'failed';cancel();options.onError(reason)}),
   native.addListener('end',()=>{if(!valid())return;release();if(received.trim())options.onEnd();else options.onError('noSpeech')})];
  // Offline models vary by device and locale. The OS chooses its configured service;
  // the review UI explains that recognition may use Apple/Android network services.
  options.onReady?.();
  native.start({lang:speechLocale(options.language),interimResults:true,continuous:false,maxAlternatives:1,
   ...(options.uri?{audioSource:{uri:options.uri,sampleRate:44100,audioChannels:1,audioEncoding:2}}:{})});
  timer=setTimeout(()=>{if(!valid())return;cancel();options.onError('timeout')},90000);
  return cancel;
 }catch{cancel();if(options.valid())options.onError('failed');return ()=>{}}
}
export function stopDictation(){native.stop()}
