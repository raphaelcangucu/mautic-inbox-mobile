import type {Account, Conversation, Message, Template} from './types.ts';
export const demoAccounts: Account[] = [
  {id:'macro-7',origin:'https://macro.demo.invalid',name:'Macro Markets',user:{id:7,name:'Raphael',email:'raphael@example.com'}},
  {id:'studio-9',origin:'https://studio.demo.invalid',name:'Mautic Studio',user:{id:9,name:'Ana',email:'ana@example.com'}},
];
export function seed(account: Account): {conversations: Conversation[]; messages: Record<number,Message[]>} {
  const names=['Marina Costa','Pedro Almeida','Juliana Santos','Lucas Ferreira'];
  const texts=['Quero entender o relatório da rodada.','Enviei RELATORIO no comentário.','Como ler os indicadores?','Obrigado pela ajuda!'];
  const now=Date.now();
  const conversations=names.map((name,i): Conversation=>({id:i+1,conversation_id:100+i,version:1,channel:(['whatsapp','instagram','webchat','facebook'] as const)[i],contact_name:account.id==='studio-9'?['Beatriz Lima','Rafael Alves','Sofia Martins','Gabriel Silva'][i]:name,preview:texts[i],avatar_url:null,asset:{id:i+10,name:account.name},recipient:'551199900'+i+'000',assignee:i===0||i===3?{id:account.user.id,name:account.user.name}:null,lifecycle:i===3?'resolved':'open',needs_response:i!==3,unread:i<2?2-i:0,human_takeover:i!==2,last_message_at:new Date(now-i*480000).toISOString(),updated_at:new Date(now).toISOString(),contact:{id:i+200,name,email:'contato'+i+'@example.com',phone:'+55 11 99900-000'+i},origins:{campaign:'Relatório da rodada',...(i===2?{page:'https://site.example/relatorio',utm_source:'webchat',utm_campaign:'rodada-27'}:{})},can_reply:true,reply_blocked_reason:null,mobile:{avatarKey:(['camila','ricardo','bia','lucas'] as const)[i],ai:i===2,window_open:true,attachments:i===0||i===2}}));
  const messages: Record<number,Message[]>={};
  for(const c of conversations) messages[c.id]=[
    {kind:'message',id:1,body:'Olá! Quero entender o relatório da rodada. Vocês podem me ajudar?',direction:'inbound',timestamp:new Date(now-1500000).toISOString(),status:'read'},
    {kind:'outbound',id:2,body:'Olá! Claro. Você quer acompanhar algum mercado ou entender como ler o relatório?',direction:'outbound',timestamp:new Date(now-1200000).toISOString(),status:'sent',request_id:'seed-'+c.id},
    {kind:'message',id:3,body:c.preview,direction:'inbound',timestamp:c.last_message_at,status:'read'},
  ];
  // Long deterministic history to exercise pagination and scroll restoration.
  messages[1]=[...Array.from({length:63},(_,i):Message=>({kind:i%2?'outbound':'message',id:100+i,body:i%2?'Segue a explicação do indicador '+(i+1)+'.':'Tenho uma dúvida sobre o indicador '+(i+1)+'.',direction:i%2?'outbound':'inbound',status:i%2?'sent':'read',timestamp:new Date(now-(140-i)*60000).toISOString()})),...messages[1].slice(0,2),{kind:'message',id:3,body:'Principalmente os jogos de domingo. Tenho uma dúvida neste trecho:',direction:'inbound',timestamp:new Date(now-60000).toISOString(),status:'read'},{kind:'message',id:4,body:'',direction:'inbound',timestamp:new Date(now-45000).toISOString(),status:'read',attachment:{demoKey:'document',name:'Trecho do relatório.pdf',mime:'application/pdf',size:253952}},{kind:'event',id:5,body:'Você assumiu o atendimento · IA pausada',timestamp:new Date(now-30000).toISOString()}];
  for(const c of conversations){c.kind='inbox';c.moderation={spam:false,hidden:false,blockedAuthor:false};if(c.mobile.ai)c.agent={key:'relatorio',name:'Assistente do relatório',status:'active',count:3};}
  const comments:Conversation[]=[
    {...conversations[1],id:5,conversation_id:105,kind:'comments',preview:'RELATORIO! Meu e-mail é pedro@example.com.',assignee:null,comment:{postTitle:'Relatório da rodada · Instagram',postBody:'Veja os indicadores dos jogos de domingo. Comente RELATORIO para receber.',permalink:'https://www.instagram.com/',relatedId:2,canPrivate:true}},
    {...conversations[3],id:6,conversation_id:106,kind:'comments',lifecycle:'open',needs_response:true,unread:1,assignee:null,preview:'Onde encontro o relatório completo?',comment:{postTitle:'Análise da rodada · Facebook',postBody:'Os destaques da rodada estão disponíveis. Qual indicador você quer conhecer?',permalink:'https://www.facebook.com/',relatedId:4,canPrivate:true}},
    {...conversations[1],id:7,conversation_id:107,kind:'comments',contact_name:'Perfil suspeito',recipient:'spam-author-demo',contact:null,assignee:null,preview:'Ganhe dinheiro rápido! Acesse nosso link.',comment:{postTitle:'Relatório da rodada · Instagram',postBody:'Veja os indicadores dos jogos de domingo.',permalink:'https://www.instagram.com/',canPrivate:false}},
  ];
  conversations.push(...comments);
  for(const c of comments)messages[c.id]=[{kind:'comment',id:c.id,body:c.preview,direction:'inbound',timestamp:c.last_message_at,author:c.contact_name}];
  messages[3].push({kind:'automatic',id:22,body:'Olá! Posso ajudar você a ler os indicadores.',timestamp:new Date(now-10000).toISOString(),direction:'outbound',ai:'Assistente do relatório'});
  messages[2].push(...(['image','audio','video','document'] as const).map((demoKey,i):Message=>({kind:'message',id:30+i,body:i===0?'Exemplos de mídia fictícia para validar o atendimento.':'',timestamp:new Date(now-40000+i*1000).toISOString(),direction:'inbound',attachment:{demoKey,name:['Imagem de demonstração','Áudio de demonstração.wav','Vídeo de demonstração.mp4','Documento de demonstração.pdf'][i],mime:['image/png','audio/wav','video/mp4','application/pdf'][i]}})));
  return {conversations,messages};
}
export const templates: Template[]=[
  {id:101,name:'retomar_atendimento',language:'pt_BR',category:'UTILITY',supported:true,preview:'Olá, {{1}}! Podemos retomar seu atendimento sobre {{2}}?',fields:[{key:'BODY:1',token:'1',component:'BODY'},{key:'BODY:2',token:'2',component:'BODY'}],parts:[{type:'BODY',text:'Olá, {{1}}! Podemos retomar seu atendimento sobre {{2}}?'}]},
  {id:102,name:'relatorio_disponivel',language:'pt_BR',category:'MARKETING',supported:true,preview:'Olá, {{1}}! O relatório que você solicitou está disponível.',fields:[{key:'BODY:1',token:'1',component:'BODY'}],parts:[{type:'BODY',text:'Olá, {{1}}! O relatório que você solicitou está disponível.'}]},
];
