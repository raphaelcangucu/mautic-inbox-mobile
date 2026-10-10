import {ApiError,type Attachment} from '../api/types.ts';
export const MAX_AUDIO_BYTES=2097152;
export function checkedAudio(value:unknown):Attachment&{uri:string}{
 const audio=value as Attachment;
 if(!audio||audio.mime!=='audio/mp4'||typeof audio.uri!=='string'||!audio.uri.startsWith('file://')||typeof audio.size!=='number'||!Number.isFinite(audio.size)||audio.size<=0||audio.size>MAX_AUDIO_BYTES||typeof audio.duration!=='number'||!Number.isFinite(audio.duration)||audio.duration<=0||audio.duration>181000)throw new ApiError(422,'invalid_audio','Áudio inválido ou muito grande.');
 return audio as Attachment&{uri:string};
}
export function checkedAudioId(value:unknown){
 const id=(value as {audio_id?:unknown})?.audio_id;
 if(typeof id!=='string'||!/^[a-f0-9]{32}$/.test(id))throw new ApiError(502,'invalid_response','Resposta de upload inválida.');
 return id;
}
