export type CommentPage={cursor:string;filters:Record<string,unknown>};
export type CommentClassification={id:number;name:string;body:string;account:string;classification:'spam'|'legitimate'|'uncertain';reason:string;reply_available:boolean};
export type CommentSweep={question:string;next:CommentPage|null;seen:number[];cursors:string[];spam:number;legitimate:number;uncertain:number;status:'running'|'paused'|'complete'};
export function checkedCommentClassifications(raw:unknown):CommentClassification[]{
 if(raw===undefined)return [];
 if(!Array.isArray(raw)||raw.length>20)throw Error('Invalid comment classifications');
 const ids=new Set<number>();
 for(const row of raw){if(!row||!Number.isInteger(row.id)||row.id<1||ids.has(row.id)||!['spam','legitimate','uncertain'].includes(row.classification)||!['name','body','account','reason'].every(key=>typeof row[key]==='string')||typeof row.reply_available!=='boolean')throw Error('Invalid comment classification');ids.add(row.id)}
 return raw;
}
export function checkedCommentPage(raw:unknown):CommentPage|null{
 if(raw===undefined||raw===null)return null;
 const p=raw as CommentPage;
 if(typeof p.cursor!=='string'||!p.cursor||p.cursor.length>512||!p.filters||typeof p.filters!=='object'||Array.isArray(p.filters))throw Error('Invalid comment page');
 return p;
}
export function startCommentSweep(question:string,next:CommentPage|null=null):CommentSweep{return {question,next,seen:[],cursors:[],spam:0,legitimate:0,uncertain:0,status:'running'}}
export function advanceCommentSweep(state:CommentSweep,rows:CommentClassification[],next:CommentPage|null):CommentSweep{
 const seen=new Set(state.seen),counts={spam:state.spam,legitimate:state.legitimate,uncertain:state.uncertain};
 for(const row of rows)if(!seen.has(row.id)){seen.add(row.id);counts[row.classification]++}
 if(next&&state.cursors.includes(next.cursor))throw Error('Comment pagination did not advance');
 return {...state,...counts,seen:[...seen],next,cursors:next?[...state.cursors,next.cursor]:state.cursors,status:next?'running':'complete'};
}
export function wantsCommentSweep(question:string):boolean{return /(?:coment|comment|spam)/iu.test(question)&&/(?:todos|todas|varr|sweep|all\b|every|todos los)/iu.test(question)}
export const commentSweepKey=(agent:string)=>`assistant:comment-sweep:${agent}`;
