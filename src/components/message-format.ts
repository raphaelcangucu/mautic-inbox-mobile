import MarkdownIt from 'markdown-it';

export type MessageNode = {type:string; text?:string; markup?:string; href?:string; start?:number; children:MessageNode[]};
const parser = new MarkdownIt({html:false,linkify:true,breaks:true});
// Parse text into native elements. Never execute HTML or fetch Markdown images.
export function messageDocument(body:string):MessageNode[] {
 if(body.length>50000)return [{type:'paragraph',children:[{type:'text',text:body,children:[]}]}];
 const root:MessageNode={type:'root',children:[]};const stack=[root];
 for(const token of parser.parse(body,{})) {
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
  if(token.type==='image')node.text=token.content; // Alt text only; no remote tracking pixels.
  stack[stack.length-1].children.push(node);if(token.nesting===1)stack.push(node);
 }
 return root.children;
}
export function messageLink(value:string):string|null {
 try{const url=new URL(value);return ['https:','http:','mailto:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null}catch{return null}
}
