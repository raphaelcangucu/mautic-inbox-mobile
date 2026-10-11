import MarkdownIt from 'markdown-it';
import type {Channel} from '../api/types.ts';
import {instagramProfile,profileURL} from '../api/social-profiles.ts';

export type MessageNode = {type:string; text?:string; markup?:string; href?:string; start?:number; children:MessageNode[]};
const parser = new MarkdownIt({html:false,linkify:true,breaks:true});
// Parse before emphasis so leading/trailing underscores remain part of the handle.
// Channel lives in the parse environment, never in mutable/shared parser state.
parser.inline.ruler.before('emphasis','social_mention',(state,silent)=>{
 const channel=state.env?.channel;
 if((channel!=='instagram'&&channel!=='facebook')||state.src[state.pos]!=='@'||(state as typeof state&{linkLevel?:number}).linkLevel)return false;
 let wordStart=state.pos;while(wordStart>0&&!/\s/u.test(state.src[wordStart-1]))wordStart--;
 const before=state.src.slice(wordStart,state.pos);const boundary=before.replace(/[*_~]+$/,'');const previous=boundary.at(-1);
 if(previous&&!/[\s([{“‘"'«:;,!?]/u.test(previous))return false;
 // Do not split a URL containing a mention-shaped path/query fragment.
 if(/(?:https?:\/\/|www\.)\S*$/i.test(before))return false;
 const match=/^@([a-zA-Z0-9._]+)/.exec(state.src.slice(state.pos,state.posMax));
 if(!match)return false;
 let handle=match[1].replace(/\.+$/,'');
 const emphasis=before.slice(boundary.length);
 if(/^_{1,2}$/.test(emphasis)&&handle.endsWith(emphasis))handle=handle.slice(0,-emphasis.length);
 const after=state.src[state.pos+match[0].length];
 if(after&&(/[\p{L}\p{N}\p{M}]/u.test(after)||after==='@'||after==='-'))return false;
 const href=channel==='instagram'?instagramProfile(handle):profileURL('facebook','https://www.facebook.com/'+handle+'/');
 if(!href)return false;
 if(!silent){const token=state.push('social_mention','',0);token.content='@'+handle;token.attrSet('href',href)}
 state.pos+=handle.length+1;return true;
});
// Parse text into native elements. Never execute HTML or fetch Markdown images.
export function messageDocument(body:string,channel?:Channel):MessageNode[] {
 if(body.length>50000)return [{type:'paragraph',children:[{type:'text',text:body,children:[]}]}];
 const root:MessageNode={type:'root',children:[]};const stack=[root];
 for(const token of parser.parse(body,{channel})) {
  const parent=stack[stack.length-1];
  if(token.nesting===-1){stack.pop();continue}
  const node:MessageNode={type:token.type.replace(/_open$/,''),markup:token.markup,children:[]};
  if(token.type==='inline')node.children=inlineNodes(token.children||[]);
  else if(token.type==='fence'||token.type==='code_block')node.text=token.content.replace(/\n$/,'');
  if(token.type==='ordered_list_open')node.start=Number(token.attrGet('start')||1);
  parent.children.push(node);if(token.nesting===1)stack.push(node);
 }
 return root.children;
}
function inlineNodes(tokens:ReturnType<typeof parser.parse>):MessageNode[]{
 const root:MessageNode={type:'inline',children:[]};const stack=[root];
 for(const token of tokens){
  if(token.nesting===-1){stack.pop();continue}
  const node:MessageNode={type:token.type.replace(/_open$/,''),markup:token.markup,text:token.content,children:[]};
  if(token.type==='link_open')node.href=messageLink(String(token.attrGet('href')||''))||undefined;
  if(token.type==='social_mention'){node.type='mention';node.href=messageLink(String(token.attrGet('href')||''))||undefined}
  if(token.type==='image')node.text=token.content; // Alt text only; no remote tracking pixels.
  stack[stack.length-1].children.push(node);if(token.nesting===1)stack.push(node);
 }
 return root.children;
}
export function messageLink(value:string):string|null {
 try{const url=new URL(value);return ['https:','http:','mailto:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null}catch{return null}
}
