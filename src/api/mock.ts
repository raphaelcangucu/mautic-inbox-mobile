import {t} from '../i18n/engine.ts';
import {ApiError, type Account, type ApiRequest, type Conversation, type Message, type Transport} from './types.ts';
import {seed,templates} from './fixtures.ts';
import type {Storage} from '../storage/interface.ts';

import {upgrade,featureRequest,type Remote} from './features.ts';
export class MockTransport implements Transport {
  offline=false; latency=180; uncertainNext=false; conflictNext=false;
  private lock: Promise<unknown>=Promise.resolve();
  constructor(readonly account: Account,private disk: Storage){}
  async settle(){await this.lock}
  request<T>(r: ApiRequest): Promise<T> {
    const job=this.lock.then(()=>this.execute<T>(r));this.lock=job.catch(()=>{});return job;
  }
  private async execute<T>(r: ApiRequest): Promise<T> {
    if(this.offline)throw new ApiError(0,'offline','Sem conexão. O histórico salvo continua disponível.');
    await new Promise(resolve=>setTimeout(resolve,this.latency));
    if(this.offline)throw new ApiError(0,'offline','Conexão interrompida.');
    let remote=await this.disk.get<Remote>('mock:remote');
    if(!remote){remote={...seed(this.account),sequence:1000,schema:2};await this.disk.put('mock:remote',remote)}
    const data:Remote=JSON.parse(JSON.stringify(remote));upgrade(data,this.account);const b=r.body||{};
    const feature=featureRequest(data,this.account,r);if(feature!==undefined){await this.disk.put('mock:remote',data);return JSON.parse(JSON.stringify(feature)) as T;}
    const m=r.path.match(/^\/inbox\/api\/conversations\/(\d+)(?:\/(\w+))?$/);
    const c=m?data.conversations.find(x=>x.id===+m[1]):undefined;
    const sub=m?.[2];let value: unknown;
    if(r.path==='/inbox/api/conversations'&&r.method==='GET'){
      let items=data.conversations.filter(x=>(!r.query?.channel||x.channel===r.query.channel)&&(!r.query?.search||x.contact_name.toLowerCase().includes(String(r.query.search).toLowerCase())));
      if(r.query?.kind)items=items.filter(x=>(x.kind||'inbox')===r.query!.kind);
      if(r.query?.queue==='mine')items=items.filter(x=>x.assignee?.id===this.account.user.id);
      if(r.query?.queue==='unassigned')items=items.filter(x=>x.assignee===null);
      if(r.query?.lifecycle&&r.query.lifecycle!=='all')items=items.filter(x=>r.query!.lifecycle==='active'?x.lifecycle!=='resolved':x.lifecycle===r.query!.lifecycle);
      if(String(r.query?.needs_response)==='true')items=items.filter(x=>x.needs_response);
      const offset=Number(r.query?.cursor||0);const limit=Math.min(50,Number(r.query?.limit||25));
      value={items:items.slice(offset,offset+limit),next_cursor:offset+limit<items.length?String(offset+limit):null,counts:{all:items.length,mine:items.filter(x=>x.assignee?.id===this.account.user.id).length,unassigned:items.filter(x=>x.assignee===null).length}};
    }else if(r.path==='/inbox/api/updates')value={conversations:data.conversations,timeline:r.query?.state_id?data.messages[Number(r.query.state_id)]:[],next_since:new Date().toISOString(),has_more:false};
    else if(r.path==='/inbox/mobile/assistant/messages'&&r.method==='POST'){
      const question=String(b.message||'');const waiting=/aguardando|sem resposta|awaiting|waiting|unanswered|esperando|sin respuesta/i.test(question);const history=/histórico|historico|resumir|history|summari[sz]|historial|resum/i.test(question);const segment=/segment|automa/i.test(question);const draft=!waiting&&/respost|sugest|rascunh|repl|suggest|draft|respuest|suger|borrador/i.test(question);const contact=waiting||/contat|pessoa|contact|person/i.test(question);
      if(history)value={role:'assistant',tool:'inbox_history · mock',text:t("mock.assistantHistory",{assignee:data.conversations.find(x=>x.id===Number(b.conversation_id))?.assignee?.name||t("mock.team")})};else if(segment)value={role:'assistant',tool:'mautic_search_segments · mock',text:t("mock.assistantSegments")};else if(waiting)value={role:'assistant',tool:'inbox_search_conversations · mock',text:data.conversations.filter(x=>x.needs_response&&!x.moderation?.spam&&!x.moderation?.blockedAuthor).map(x=>x.contact_name+' · '+x.channel).join('\n')};else value={role:'assistant',tool:draft?'inbox_context · mock':contact?'mautic_search_contacts · mock':'mautic_search_campaigns · mock',text:draft?t("mock.assistantDraft"):contact?t("mock.assistantContacts",{count:new Set(data.conversations.filter(x=>!x.moderation?.spam&&!x.moderation?.blockedAuthor).map(x=>x.contact?.id||x.channel+':'+x.recipient)).size}):t("mock.assistantCampaigns")};
    }
    else if(c){
      if(r.method==='GET'&&!sub)value=c;
      else if(sub==='history'){
        const all=data.messages[c.id]||[];const before=Number(r.query?.before||all.length);const start=Math.max(0,before-Number(r.query?.limit||40));value={items:all.slice(start,before),next_cursor:start?String(start):null};
      }else if(sub==='templates')value={items:c.channel==='whatsapp'?templates:[],blocked_reason:null};
      else if(sub==='draft'&&r.method==='PUT')value={saved:true,updated_at:new Date().toISOString()};
      else if(['take','state'].includes(sub||'')&&r.method==='POST'){
        if(this.conflictNext){this.conflictNext=false;c.version++;await this.disk.put('mock:remote',data);throw new ApiError(409,'version_conflict','A conversa mudou. Atualize antes de tentar novamente.')}
        if(b.action!=='read'&&Number(b.version)!==c.version)throw new ApiError(409,'version_conflict','A conversa mudou. Atualize antes de tentar novamente.');
        if(sub==='take'){if(c.assignee&&c.assignee.id!==this.account.user.id)throw new ApiError(409,'assigned','Conversa com outro atendente.');c.assignee=this.account.user;c.mobile.ai=false;if(c.agent)c.agent.status='paused';c.human_takeover=true;c.lifecycle='open';c.snoozed_until=null;}
        else if(b.action==='read')c.unread=0;
        else if(b.action==='resolve'){if(c.assignee?.id!==this.account.user.id)throw new ApiError(409,'assigned','Assuma a conversa primeiro.');c.lifecycle='resolved';c.needs_response=false;}
        else if(b.action==='reopen'){c.lifecycle='open';c.snoozed_until=null;}
        else if(b.action==='transfer'){const target=Number(b.target_user_id);if(![this.account.user.id,42].includes(target))throw new ApiError(422,'user','Atendente indisponível.');c.assignee={id:target,name:target===42?'Carla · Atendimento':this.account.user.name};c.human_takeover=true;c.mobile.ai=false;if(c.agent)c.agent.status='paused';}
        else if(b.action==='unassign'){c.assignee=null;c.human_takeover=true;c.mobile.ai=false;if(c.agent)c.agent.status='paused';}
        else if(b.action==='snooze'){const until=Date.parse(String(b.until));if(!Number.isFinite(until)||until<=Date.now())throw new ApiError(422,'until','Escolha um horário futuro.');c.lifecycle='snoozed';c.snoozed_until=new Date(until).toISOString();c.human_takeover=true;c.mobile.ai=false;if(c.agent)c.agent.status='paused';}
        else throw new ApiError(422,'unsupported_action','Ação indisponível nesta demonstração.');
        if(b.action!=='read'){c.version++;data.messages[c.id].push({kind:'event',id:++data.sequence,body:({take:'Você assumiu o atendimento · IA pausada',transfer:'Conversa transferida para '+c.assignee?.name,unassign:'Conversa devolvida à fila',snooze:'Atendimento adiado',resolve:'Conversa resolvida',reopen:'Conversa reaberta'} as Record<string,string>)[sub==='take'?'take':String(b.action)]||'Atendimento atualizado',timestamp:new Date().toISOString()});}c.updated_at=new Date().toISOString();value=c;
      }else if(['reply','note'].includes(sub||'')&&r.method==='POST'){
        const body=String(b.body||'').trim();if(!body||body.length>4000)throw new ApiError(422,'invalid_body','Escreva uma mensagem com até 4.000 caracteres.');
        const request=String(b.request_id||'');if(sub==='reply'&&!/^[A-Za-z0-9_-]{8,64}$/.test(request))throw new ApiError(422,'request_id','request_id inválido.');
        const found=data.messages[c.id].find(x=>x.request_id===request&&request);
        if(found)return JSON.parse(JSON.stringify({request_id:request,status:found.status,item:found,summary:c})) as T;
        if(sub==='reply'){
          if(c.moderation?.spam||c.moderation?.blockedAuthor)throw new ApiError(422,'spam','Restaure a conversa ou desbloqueie o autor antes de responder.');
          if(c.lifecycle==='resolved')throw new ApiError(422,'resolved','Reabra a conversa antes de responder.');
          if(c.kind==='comments'&&b.reply_mode==='private'&&!c.comment?.canPrivate)throw new ApiError(422,'private_unavailable','Resposta privada indisponível para este comentário.');
          if(c.assignee&&c.assignee.id!==this.account.user.id)throw new ApiError(409,'assigned','Assuma a conversa antes de responder.');
          if(!c.mobile.window_open&&!b.template_id)throw new ApiError(422,'window_closed','Janela encerrada. Escolha um template aprovado.');
          if(b.template_id){const template=templates.find(t=>t.id===b.template_id);if(!template||c.channel!=='whatsapp')throw new ApiError(422,'template','Template indisponível.');const vars=b.variables as Record<string,string>;if(template.fields.some(f=>!vars?.[f.key]?.trim()))throw new ApiError(422,'variables','Preencha as variáveis do template.');}
          if(b.attachment&&!c.mobile.attachments)throw new ApiError(422,'attachment','Anexos não habilitados neste canal.');
          c.assignee=this.account.user;c.mobile.ai=false;if(c.agent)c.agent.status='paused';c.human_takeover=true;c.needs_response=false;c.preview=body;c.last_message_at=new Date().toISOString();
        }
        const message: Message={kind:sub==='note'?'note':'outbound',id:++data.sequence,body,timestamp:new Date().toISOString(),author:this.account.user.name,...(sub==='reply'?{direction:'outbound',request_id:request,status:'pending',attachment:b.attachment,replyMode:c.kind==='comments'?(b.reply_mode==='private'?'private':'public'):undefined}: {})} as Message;
        if(sub==='reply'&&c.kind==='comments'&&b.reply_mode==='private'){
          const related=data.conversations.find(x=>x.id===c.comment?.relatedId);if(!related)throw new ApiError(422,'private_unavailable','Conversa privada indisponível.');
          related.lifecycle='open';related.assignee=this.account.user;related.human_takeover=true;related.mobile.ai=false;related.preview=body;related.version++;related.last_message_at=message.timestamp;
          data.messages[related.id].push({...message,replyMode:undefined});
        }
        data.messages[c.id].push(message);value=sub==='note'?{id:message.id,saved:true,item:message}:{request_id:request,status:'pending',item:message,summary:c};
        await this.disk.put('mock:remote',data);
        if(this.uncertainNext&&sub==='reply'){this.uncertainNext=false;throw new ApiError(504,'uncertain','Envio sem confirmação. Verifique o histórico antes de reenviar.')}
      }else throw new ApiError(404,'not_found','Operação não encontrada.');
    }else throw new ApiError(404,'not_found','Conversa ou operação não encontrada.');
    await this.disk.put('mock:remote',data);return JSON.parse(JSON.stringify(value)) as T;
  }
  async inject(conversationId: number,body='Recebi, obrigado! Pode me explicar mais?') {
    const data=await this.disk.get<Remote>('mock:remote');if(!data)return;
    const c=data.conversations.find(x=>x.id===conversationId)!;const item:Message={kind:'message',id:++data.sequence,body,direction:'inbound',timestamp:new Date().toISOString(),status:'read'};
    data.messages[conversationId].push(item);if(c.moderation?.spam||c.moderation?.blockedAuthor){await this.disk.put('mock:remote',data);return item;}c.lifecycle='open';c.snoozed_until=null;c.version++;c.unread++;c.needs_response=true;c.preview=body;c.mobile.window_open=true;c.last_message_at=item.timestamp;await this.disk.put('mock:remote',data);return item;
  }
  async closeWindow(conversationId: number){const data=await this.disk.get<Remote>('mock:remote');if(!data)return;const c=data.conversations.find(x=>x.id===conversationId)!;c.mobile.window_open=false;c.can_reply=false;c.reply_blocked_reason='Janela encerrada. Use um template.';await this.disk.put('mock:remote',data)}
}
