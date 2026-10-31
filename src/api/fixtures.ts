import type {Account, Conversation, Message, Template} from './types.ts';
export const demoAccounts: Account[] = [
  {id:'macro-7',origin:'https://macro.demo.invalid',name:'Macro Markets',user:{id:7,name:'Raphael',email:'raphael@example.com'},config:{version:1,name:'Macro Markets',origin:'https://macro.demo.invalid',api_base:'https://macro.demo.invalid/inbox/mobile/api',authorization_endpoint:'https://macro.demo.invalid/authorize',token_endpoint:'https://macro.demo.invalid/token',redirect_uri:'mautic-inbox-demo://oauth/callback',capabilities:{availability:true}}},
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
  const email=emailSeed(account,now);conversations.push(...email.conversations);Object.assign(messages,email.messages);
  return {conversations,messages};
}
export type DemoEmailAccount={id:number;name:string;address:string;active:boolean};
export type DemoContact={id:number;name:string;email:string;phone:string;dnc?:boolean};
export const demoForms=[{id:12,name:'Pesquisa: por que não depositou'},{id:14,name:'Satisfação com o atendimento'}];
const domain=(account:Account)=>account.id==='macro-7'?'macromarkets.com':'mautic-studio.example';
export function demoEmailAccounts(account:Account):DemoEmailAccount[]{
  const d=domain(account);
  return [{id:31,name:account.name,address:'contato@'+d,active:true},{id:32,name:account.name+' Suporte',address:'suporte@'+d,active:true},{id:33,name:account.name+' Promoções',address:'promocoes@'+d,active:false}];
}
/** Directory-only contacts: one ready for a first e-mail, one without e-mail and one that asked not to receive e-mail. */
export function demoContacts(account:Account):DemoContact[]{
  const macro=account.id==='macro-7';
  return [{id:232,name:macro?'Ana Beatriz Rocha':'Clara Nogueira',email:macro?'ana.rocha@example.com':'clara.nogueira@example.com',phone:''},{id:230,name:macro?'Paulo Mendes':'Otávio Lins',email:'',phone:'+55 11 99800-0030'},{id:231,name:macro?'Carla Nunes':'Renata Prado',email:macro?'carla.nunes@example.com':'renata.prado@example.com',phone:'',dnc:true}];
}
/** E-mail conversations as the Inbox 1.9 timeline returns them: a long thread with quoted text, attachments, an auto-reply, a survey and an internal note. */
export function emailSeed(account:Account,now=Date.now()):{conversations:Conversation[];messages:Record<number,Message[]>}{
  const macro=account.id==='macro-7';const [main,support]=demoEmailAccounts(account);const user=account.user;
  const lead=macro?{name:'João Ribeiro',first:'João',address:'joao.ribeiro@example.com'}:{name:'Helena Duarte',first:'Helena',address:'helena.duarte@example.com'};
  const client=macro?{name:'Fernanda Lima',address:'fernanda.lima@example.com',company:'Banco Exemplo'}:{name:'Tiago Moreira',address:'tiago.moreira@example.com',company:'Agência Exemplo'};
  const subject=macro?'Por que você ainda não depositou?':'Sua campanha ainda não foi publicada';const re='Re: '+subject;
  const at=(ms:number)=>new Date(now-ms).toISOString();const day=86400000,hour=3600000,minute=60000;
  const ours={name:user.name+' · '+main.name,address:main.address};const theirs={name:lead.name,address:lead.address};const box={name:main.name,address:main.address};
  const mail=(from:{name:string;address:string},to:{name:string;address:string},extra:Partial<NonNullable<Message['email']>>={})=>({from,to:[to],cc:[],quoted:null,has_html:false,has_original:false,auto_reply:false,unverified_sender:false,kind:'message',...extra});
  const quote=(when:string,text:string)=>`> Em ${new Date(when).toLocaleDateString('pt-BR')}, ${ours.name} <${ours.address}> escreveu:\n>\n`+text.split('\n').map(line=>'> '+line).join('\n');
  const file=(message:number,index:number)=>`${account.origin}/inbox/mobile/api/email/${message}/attachments/${index}`;
  const t1=at(3*day),t3=at(2*day),t4=at(2*day-50*minute),t5=at(2*day-7*hour),t6=at(day),t7=at(day-2*hour),t8=at(day-2*hour-6*minute),t9=at(day-2*hour-11*minute),t10=at(5*minute);
  const first=macro?`Olá, ${lead.first}!\n\nVi que você abriu sua conta na ${account.name}, mas ainda não fez o primeiro depósito. Ficou alguma dúvida que eu possa responder?\n\nÉ só responder este e-mail: quem lê é uma pessoa da equipe, não um robô.\n\nAbraço,\n${user.name}`:`Olá, ${lead.first}!\n\nSua campanha está pronta, mas ainda não foi publicada. Posso ajudar com algum ajuste?\n\nAbraço,\n${user.name}`;
  const answer=macro?`Oi, ${lead.first}! O depósito mínimo é **R$ 100** e aceitamos Pix, sim: o valor cai na conta em poucos minutos.\n\nObrigado pelo extrato. Com esse perfil, a conta Investidor já atende bem.`:`Oi, ${lead.first}! O orçamento mínimo é **R$ 100** por campanha e você pode pausar a qualquer momento.`;
  const survey=macro?`O saque cai no mesmo dia útil quando pedido até as 15h.\n\nPara entendermos o que mais pesa na sua decisão, você pode responder esta pesquisa rápida? Leva dois minutos.\n\n[${demoForms[0].name}](${account.origin}/inbox/f/demo-12)`:`Os relatórios ficam disponíveis no mesmo dia.\n\nPode responder esta pesquisa rápida?\n\n[${demoForms[0].name}](${account.origin}/inbox/f/demo-12)`;
  const thread:Message[]=[
    {kind:'outbound',id:9001,direction:'outbound',status:'read',author:user.name,timestamp:t1,subject,body:first,email:mail(ours,theirs,{has_html:true})},
    {kind:'message',id:9002,direction:'inbound',status:'read',timestamp:at(3*day-2*minute),subject:'Resposta automática: '+subject,body:'Estou fora do escritório até segunda-feira, com acesso limitado ao e-mail.',email:mail(theirs,box,{auto_reply:true,kind:'auto_reply'})},
    {kind:'message',id:9003,direction:'inbound',status:'read',timestamp:t3,subject:re,body:macro?`Oi, ${user.name}! Ainda estou decidindo. **Qual é o depósito mínimo?** E vocês aceitam Pix?\n\nAnexei o extrato da corretora que uso hoje e um print da carteira, caso ajude.`:`Oi, ${user.name}! Ainda estou revisando. **Qual é o orçamento mínimo?**\n\nAnexei o briefing e um print do painel.`,email:mail(theirs,box,{quoted:quote(t1,first),has_html:true,has_original:true}),attachments:[{name:macro?'extrato-corretora-setembro.pdf':'briefing-campanha.pdf',uri:file(9003,0),mime:'application/pdf',size:183422,available:true,demoKey:'document'},{name:macro?'carteira-atual.png':'painel.png',uri:file(9003,1),mime:'image/png',size:3583,available:true,demoKey:'chart'},{name:'simulador.xlsm',mime:'application/vnd.ms-excel.sheet.macroEnabled.12',size:44120,available:false}]},
    {kind:'outbound',id:9004,direction:'outbound',status:'read',author:user.name,timestamp:t4,subject:re,body:answer,email:mail(ours,theirs,{has_html:true})},
    {kind:'message',id:9005,direction:'inbound',status:'read',timestamp:t5,subject:re,body:macro?'Perfeito. E se eu precisar sacar, demora quanto?':'Perfeito. E os relatórios, demoram quanto?',email:mail(theirs,box,{quoted:quote(t4,answer),has_html:true,has_original:true})},
    {kind:'outbound',id:9006,direction:'outbound',status:'delivered',author:user.name,timestamp:t6,subject:re,body:survey,email:mail(ours,theirs,{has_html:true})},
    {kind:'event',id:9007,timestamp:t7,body:`${lead.name} abriu o formulário ${demoForms[0].name}`},
    {kind:'event',id:9008,timestamp:t8,body:`${lead.name} respondeu o formulário ${demoForms[0].name} · Principal motivo: ainda comparando ${macro?'corretoras':'agências'}`},
    {kind:'note',id:9009,timestamp:t9,author:user.name,body:'Lead quente: respondeu a pesquisa. Priorizar o retorno hoje.'},
    {kind:'message',id:9010,direction:'inbound',status:'read',timestamp:t10,subject:re,body:`Respondi a pesquisa! Uma última dúvida: o gráfico abaixo é da minha ${macro?'carteira':'conta'} atual. **${macro?`Consigo trazer esses ativos para a ${account.name} sem vender?`:'Consigo importar esse histórico?'}**\n\n![Gráfico da ${macro?'carteira':'conta'} atual](${file(9010,0)})\n\nObrigado,\n${lead.first}`,email:mail(theirs,box,{quoted:quote(t6,survey),has_html:true,has_original:true}),attachments:[{name:'grafico.png',uri:file(9010,0),mime:'image/png',size:3583,available:true,demoKey:'chart'}]},
  ];
  const help=macro?'Cobrança de taxa de custódia':'Dúvida sobre a fatura';const helpBody=macro?`Bom dia! No site diz que não há taxa de custódia, mas apareceu uma cobrança de R$ 12,90 no meu extrato deste mês. Podem verificar?\n\n![Logo ${client.company}](https://images.demo.invalid/assinatura/logo.png)\n\n**${client.name}**\nGerente financeira · ${client.company}`:`Bom dia! Recebi uma fatura em duplicidade. Podem verificar?\n\n![Logo ${client.company}](https://images.demo.invalid/assinatura/logo.png)\n\n**${client.name}**\n${client.company}`;
  const supportBox={name:support.name,address:support.address};const customer={name:client.name,address:client.address};
  const second:Message[]=[
    {kind:'message',id:9101,direction:'inbound',status:'read',timestamp:at(26*hour),subject:help,body:helpBody,email:mail(customer,supportBox,{has_html:true,has_original:true,unverified_sender:true})},
    {kind:'outbound',id:9102,direction:'outbound',status:'delivered',author:user.name,timestamp:at(25*hour),subject:'Re: '+help,body:`Olá, ${client.name.split(' ')[0]}! Obrigado por avisar. Vou verificar a cobrança com o time financeiro e retorno até amanhã.`,email:mail({name:user.name+' · '+support.name,address:support.address},customer,{has_html:true})},
  ];
  const base=(id:number,name:string,recipient:string,contact:number,asset:DemoEmailAccount):Conversation=>({id,conversation_id:100+id,version:1,channel:'email',kind:'inbox',contact_name:name,preview:'',avatar_url:null,asset:{id:asset.id,name:asset.name,type:'email_account',address:asset.address},recipient,assignee:{id:user.id,name:user.name},lifecycle:'open',needs_response:false,unread:0,human_takeover:true,last_message_at:at(0),updated_at:at(0),contact:{id:contact,name,email:recipient,phone:''},origins:{campaign:macro?'Leads sem depósito':'Campanhas pendentes'},can_reply:true,reply_blocked_reason:null,email:{inbound:'ok',inbound_since:null},moderation:{spam:false,hidden:false,blockedAuthor:false},mobile:{ai:false,window_open:true,attachments:false}});
  const conversations:Conversation[]=[
    {...base(8,lead.name,lead.address,208,main),preview:'Respondi a pesquisa! Uma última dúvida: o gráfico abaixo é da minha '+(macro?'carteira':'conta')+' atual.',subject:re,needs_response:true,unread:1,last_message_at:t10},
    {...base(9,client.name,client.address,209,support),preview:second[1].body,subject:'Re: '+help,last_message_at:second[1].timestamp,email:{inbound:'delayed',inbound_since:at(50*minute)}},
  ];
  return {conversations,messages:{8:thread,9:second}};
}
export const templates: Template[]=[
  {id:101,name:'retomar_atendimento',language:'pt_BR',category:'UTILITY',supported:true,preview:'Olá, {{1}}! Podemos retomar seu atendimento sobre {{2}}?',fields:[{key:'BODY:1',token:'1',component:'BODY'},{key:'BODY:2',token:'2',component:'BODY'}],parts:[{type:'BODY',text:'Olá, {{1}}! Podemos retomar seu atendimento sobre {{2}}?'}]},
  {id:102,name:'relatorio_disponivel',language:'pt_BR',category:'MARKETING',supported:true,preview:'Olá, {{1}}! O relatório que você solicitou está disponível.',fields:[{key:'BODY:1',token:'1',component:'BODY'}],parts:[{type:'BODY',text:'Olá, {{1}}! O relatório que você solicitou está disponível.'}]},
];
