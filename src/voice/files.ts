import * as Files from 'expo-file-system/legacy';
import type {Attachment} from '../api/types';
const directory=(account:string)=>Files.documentDirectory+'inbox-voice-'+encodeURIComponent(account)+'/';
export async function stageAudio(account:string,attachment:Attachment){
 if(!Files.documentDirectory||!attachment.uri?.startsWith('file://'))throw Error('audio_storage_unavailable');
 const root=directory(account);await Files.makeDirectoryAsync(root,{intermediates:true});
 const uri=root+'voice-'+Date.now()+'-'+Math.random().toString(36).slice(2)+'.m4a';
 await Files.copyAsync({from:attachment.uri,to:uri});return {...attachment,uri};
}
export async function clearAccountAudio(account:string){await Files.deleteAsync(directory(account),{idempotent:true})}
export async function discardStagedAudio(account:string,uri?:string){if(uri?.startsWith(directory(account)))await Files.deleteAsync(uri,{idempotent:true})}
