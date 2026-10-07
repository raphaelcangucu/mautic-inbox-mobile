import {ApiError,type Account,type ApiRequest,type CannedResponse,type Conversation,type Message} from './types.ts';
import {seed} from './fixtures.ts';
export type Remote={conversations:Conversation[];messages:Record<number,Message[]>;sequence:number;schema?:number;canned?:CannedResponse[];catalogue?:{campaign:{id:number;name:string}[];segment:{id:number;name:string}[]}};
export function upgrade(data:Remote,account:Account){
  if(data.schema!==2){const fresh=seed(account);for(const c of fresh.conversations){const old=data.conversations.find(x=>x.id===c.id);if(old){old.kind||='inbox';old.moderation||=c.moderation;old.agent??=c.agent; if(c.id===2)data.messages[2].push(...fresh.messages[2].filter(x=>x.attachment?.demoKey));}else{data.conversations.push(c);data.messages[c.id]=fresh.messages[c.id];}}data.schema=2;}
  const pdf=data.messages[1]?.find(x=>x.attachment?.name==='Trecho do relatório.pdf');if(pdf?.attachment)pdf.attachment.demoKey='document';
  data.canned??=[{id:1,name:'Boas-vindas',body:'Olá! Vou ajudar você com sua solicitação.'},{id:2,name:'Enviar relatório',body:'O relatório está disponível. Qual rodada você quer consultar?'},{id:3,name:'Prazo de retorno',body:'Vou verificar com a equipe e retorno assim que tiver uma atualização.'}];
  for(const c of data.conversations)if(c.lifecycle==='snoozed'&&c.snoozed_until&&Date.parse(c.snoozed_until)<=Date.now()){c.lifecycle='open';c.snoozed_until=null;c.needs_response=true;c.version++;}
}
export function featureRequest(data:Remote,a:Account,r:ApiRequest):unknown|undefined{
  const b=r.body||{};
  if(r.path==='/inbox/mobile/crm-options'&&r.method==='GET'){
    const kind=String(r.query?.kind||'');if(!['campaign','segment'].includes(kind))throw new ApiError(422,'invalid_kind','Tipo de busca inválido.');
    const defaults={campaign:[{id:1,name:'Relatório da rodada'},{id:2,name:'Boas-vindas'}],segment:[{id:1,name:'Interessados em futebol'},{id:2,name:'Atendimento ativo'}]};
    const query=String(r.query?.search||'').trim().slice(0,100).toLocaleLowerCase('pt-BR');const limit=Math.max(1,Math.min(50,Number(r.query?.limit)||20));const offset=Math.max(0,Math.min(100000,Number(r.query?.cursor)||0));
    const rows=(data.catalogue||defaults)[kind as 'campaign'|'segment'].filter(x=>x.name.toLocaleLowerCase('pt-BR').includes(query)).slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')||a.id-b.id);
    return {items:rows.slice(offset,offset+limit),next_cursor:offset+limit<rows.length?String(offset+limit):null};
  }

  if(r.path==='/inbox/mobile/operator-options'&&r.method==='GET')return {users:[a.user,{id:42,name:'Carla · Atendimento'}],agents:[{key:'relatorio',name:'Assistente do relatório'},{key:'triagem',name:'Assistente de triagem'}]};
  if(r.path==='/inbox/mobile/canned-responses'&&r.method==='GET')return {items:data.canned};
  if(r.path==='/inbox/api/canned-responses'&&r.method==='POST'){
    const name=String(b.name||'').trim(),body=String(b.body||'').trim();if(!name||name.length>100||!body||body.length>4000)throw new ApiError(422,'invalid_canned','Preencha o nome e a resposta.');
    const item={id:++data.sequence,name,body};data.canned!.push(item);return item;
  }
  const m=r.path.match(/^\/inbox\/(?:api|mobile)\/conversations\/(\d+)\/(moderation|ai|email-actions|email-options)$/);if(!m)return;
  const c=data.conversations.find(x=>x.id===Number(m[1]));if(!c)throw new ApiError(404,'not_found','Conversa indisponível.');
  if(m[2]==='email-options'&&r.method==='GET')return {campaigns:[{id:1,name:'Relatório da rodada'},{id:2,name:'Boas-vindas'}],segments:[{id:1,name:'Interessados em futebol'},{id:2,name:'Atendimento ativo'}]};
  if(r.method!=='POST')throw new ApiError(405,'method','Ação inválida.');
  if(Number(b.version)!==c.version)throw new ApiError(409,'version_conflict','A conversa mudou. Atualize antes de continuar.');
  if(m[2]==='moderation'){
    if(c.kind!=='comments')throw new ApiError(422,'not_comment','Moderação disponível nos comentários.');
    c.moderation??={spam:false,hidden:false,blockedAuthor:false};
    if(b.action==='spam')c.moderation.spam=true;
    else if(b.action==='restore')c.moderation.spam=false;
    else if(b.action==='hide')c.moderation.hidden=true;
    else if(b.action==='show')c.moderation.hidden=false;
    else if(b.action==='block'||b.action==='unblock'){
      for(const related of data.conversations.filter(x=>x.channel===c.channel&&x.asset.id===c.asset.id&&x.recipient===c.recipient)){related.moderation??={spam:false,hidden:false,blockedAuthor:false};related.moderation.blockedAuthor=b.action==='block';if(related.id!==c.id)related.version++;}
    }else throw new ApiError(422,'action','Ação de moderação inválida.');
  }else if(m[2]==='ai'){
    if(c.moderation?.spam||c.moderation?.blockedAuthor||c.lifecycle==='resolved')throw new ApiError(422,'unavailable','Restaure o atendimento antes de atribuir à IA.');
    if(b.action==='reset'){if(!c.agent)throw new ApiError(422,'no_agent','Escolha um agente primeiro.');c.agent.count=0;}
    else if(b.action==='assign'){
      if(c.assignee&&c.assignee.id!==a.user.id)throw new ApiError(409,'assigned','Transfira a conversa antes de encaminhar à IA.');
      if(!['triagem','relatorio'].includes(String(b.key)))throw new ApiError(422,'agent','Agente indisponível.');
      c.agent={key:String(b.key),name:b.key==='triagem'?'Assistente de triagem':'Assistente do relatório',status:'active',count:0};c.mobile.ai=true;c.human_takeover=false;c.assignee=null;
    }else throw new ApiError(422,'action','Ação de IA inválida.');
  }else if(m[2]==='email-actions'){
    const email=String(b.email||'').trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new ApiError(422,'email','Informe um e-mail válido.');
    const conflict=data.conversations.find(x=>x.contact?.email===email&&x.contact.id!==c.contact?.id);
    if(conflict)throw new ApiError(409,'contact_conflict','Este e-mail pertence a outro contato. Revise o vínculo no Mautic.');
    const campaign=Number(b.campaign_id||0),segment=Number(b.segment_id||0);
    if(![0,1,2].includes(campaign)||![0,1,2].includes(segment))throw new ApiError(422,'target','Campanha ou segmento indisponível.');
    c.contact={id:c.contact?.id||++data.sequence,name:c.contact_name,email,phone:c.contact?.phone||''};
    if(campaign)c.campaigns=[...new Set([...(c.campaigns||[]),campaign===1?'Relatório da rodada':'Boas-vindas'])];
    if(segment)c.segments=[...new Set([...(c.segments||[]),segment===1?'Interessados em futebol':'Atendimento ativo'])];
    for(const related of data.conversations.filter(x=>x.id!==c.id&&x.contact?.id===c.contact!.id)){related.contact={...c.contact};related.campaigns=c.campaigns;related.segments=c.segments;related.version++;}
  }
  c.version++;c.updated_at=new Date().toISOString();
  data.messages[c.id].push({kind:'event',id:++data.sequence,body:m[2]==='moderation'?({spam:'Marcado como spam',restore:'Removido do spam',hide:'Comentário ocultado · simulação',show:'Comentário visível · simulação',block:'Autor bloqueado no atendimento',unblock:'Autor desbloqueado no atendimento'} as Record<string,string>)[String(b.action)]:m[2]==='ai'?(b.action==='reset'?'Sessão da IA reiniciada':'Encaminhado para '+c.agent?.name):'Contato atualizado · campanha e segmento revisados',timestamp:c.updated_at});
  return c;
}
