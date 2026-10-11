import {apiErrorText} from '../i18n/api-errors.ts';
export type Channel = 'whatsapp' | 'instagram' | 'facebook' | 'webchat';
export const channels: Record<Channel, string> = {whatsapp:'WhatsApp', instagram:'Instagram', facebook:'Facebook', webchat:'Web Chat'};
export type Filter = 'Todas' | 'Não lidas' | 'Minhas' | 'Sem resposta' | 'Sem responsável' | 'IA' | 'Lidas' | 'Em atendimento' | 'Resolvidas' | 'Adiadas' | 'Spam';
export const filters: Filter[] = ['Todas','Não lidas','Minhas','Sem resposta','Sem responsável','IA','Lidas','Em atendimento','Resolvidas','Adiadas','Spam'];
export type Account = {id: string; origin: string; name: string; user: {id: number; name: string; email: string}; expired?: boolean; mode?:'mock'|'live'; config?:import('./http').MobileConfig};
export type Session = {accessToken: string; refreshToken?: string; expiresAt: number};
export type Attachment = {name: string; uri?: string; mime: string; size?: number; duration?: number; demoKey?: 'image'|'audio'|'video'|'document'};
export type Agent = {key:string; name:string; status:'active'|'paused'; count:number};
export type CannedResponse = {id:number;name:string;body:string};
export type CommentContext = {postTitle:string;postBody:string;commentBody?:string;image?:string|null;permalink:string;relatedId?:number;canPrivate:boolean;canPublic?:boolean};
export type Conversation = {
  id: number; conversation_id: number; version: number; channel: Channel; contact_name: string; preview: string;
  avatar_url: string | null; contact_handle?:string|null; profile_url?:string|null; asset_avatar_url?:string|null; asset: {id: number; name: string;type?:string;phone?:string|null;handle?:string|null}; recipient: string;
  assignee: {id: number; name: string} | null; lifecycle: 'open'|'snoozed'|'resolved'; needs_response: boolean;
  unread: number; human_takeover: boolean; last_message_at: string; updated_at: string;
  contact: {id: number; name: string; email: string; phone: string; social_profiles?:import('./social-profiles').SocialProfiles} | null;
  origins: {campaign: string; page?: string; utm_source?: string; utm_campaign?: string};
  can_reply: boolean; can_take?:boolean; can_take_and_reply?:boolean; reply_blocked_reason: string | null;
  reply_modes?:Partial<Record<'public'|'private',{available:boolean;can_reply:boolean;blocked_reason:string|null}>>;
  access_revoked?:boolean;kind?: 'inbox'|'comments'; comment?:CommentContext; snoozed_until?:string|null;
  moderation?:{spam:boolean;hidden:boolean;blockedAuthor:boolean}; moderation_available?:boolean; agent?:Agent|null;
  segments?:string[]; campaigns?:string[];
  // Explicit mobile/mock additions, not fields claimed to exist in InboxQuery.
  mobile: {avatarKey?: 'camila'|'ricardo'|'bia'|'lucas'; ai: boolean; window_open: boolean; attachments: boolean; audio?: boolean; social_visuals?:boolean};
};
export type Message = {kind: 'message'|'comment'|'outbound'|'note'|'event'|'automatic'; id: number | string; body: string; timestamp: string; direction?: 'inbound'|'outbound'; request_id?: string; status?: 'sending'|'uncertain'|'failed'|'pending'|'sent'|'delivered'|'read'; retryable?:boolean; failure?:string|null; failure_code?:string|null; cooldown_seconds?:number|null; retry_of?:string|null; attempt_count?:number; display_id?:number|string; author?: string; attachment?: Attachment; ai?:string; replyMode?:'public'|'private'};
export type Page<T> = {items: T[]; next_cursor: string | null; complete?:boolean};
export type Template = {id: number; name: string; language: string; category: string; supported: boolean; preview: string; fields: {key: string; token: string; component: string}[]; parts: {type: string; text: string}[]};
export type Outbox = {request_id: string; conversationId: number; body: string; mode: 'reply'|'note'; timestamp: string; status: 'sending'|'uncertain'|'failed'; template_id?: number; variables?: Record<string,string>; attachment?: Attachment; replyMode?:'public'|'private'};
export type Preferences = {remotePush?: boolean; sound: boolean; vibration: boolean; preview: boolean; quiet: boolean; grouped?:boolean; suppressOpen?:boolean};
export type ViewState = {kind:'inbox'|'comments';filter: Filter; search: string; channels: Channel[]; listOffset: number; railOffset: number; chatOffsets: Record<number,number>; chatAnchors: Record<number,string>; lastChat?: number};
export const defaultView = (): ViewState => ({kind:'inbox',filter:'Todas',search:'',channels:Object.keys(channels) as Channel[],listOffset:0,railOffset:0,chatOffsets:{},chatAnchors:{}});
export const messageKey = (m: Message) => `${m.kind}:${m.id}`;
export function matches(c: Conversation, filter: Filter, userId: number) {
  if(filter==='Spam')return !!(c.moderation?.spam||c.moderation?.blockedAuthor);
  if(c.moderation?.spam||c.moderation?.blockedAuthor)return false;
  switch (filter) {
    case 'Adiadas': return c.lifecycle==='snoozed';
    case 'Não lidas': return c.unread>0;
    case 'Lidas': return c.unread===0;
    case 'Minhas': return c.assignee?.id===userId;
    case 'Sem responsável': return c.assignee===null;
    case 'Sem resposta': return c.needs_response;
    case 'IA': return c.mobile.ai;
    case 'Em atendimento': return c.lifecycle==='open'&&c.assignee!==null;
    case 'Resolvidas': return c.lifecycle==='resolved';
    default: return true;
  }
}
export class ApiError extends Error {constructor(public status: number, public code: string, message: string){super(message);Object.defineProperty(this,'message',{configurable:true,get:()=>{const localized=apiErrorText(code,status)||(/\(HTTP \d+\)/.test(message)?apiErrorText("api_error",status):null);return localized?(localized+(/\(HTTP \d+\)/.test(message)?` (HTTP ${status})`:"")):message}})}}
export type ApiRequest = {method: 'GET'|'POST'|'PUT'|'DELETE'; path: string; query?: Record<string,string|number>; body?: Record<string,unknown>};
export interface Transport {request<T>(request: ApiRequest): Promise<T>}
