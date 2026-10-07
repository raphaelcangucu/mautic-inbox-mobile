import type {InboxRepository} from '../api/repository.ts';
import type {Conversation, Message} from '../api/types.ts';

type ChatLoad = {
  valid:()=>boolean;
  flushDraft:()=>Promise<void>;
  memory?:Message[];
  offline:boolean;
  live:boolean;
  cached:(messages:Message[],draft:string,cursor:string|null)=>void;
  detail:(conversation:Conversation)=>void;
  history:(messages:Message[],cursor:string|null)=>void;
  error:(error:unknown)=>void;
};

// One coordinator per app store. Repository writes may finish in the background,
// but only the latest navigation is allowed to update the visible chat.
export class ChatNavigation {
  private opening=0;
  private mode=0;

  invalidate(){++this.opening;++this.mode;}
  editedDraft(){++this.mode;}
  guard(valid:()=>boolean){const opening=this.opening,mode=this.mode;return()=>opening===this.opening&&mode===this.mode&&valid();}

  async open(id:number,repo:InboxRepository,load:ChatLoad){
    const ticket=++this.opening;
    ++this.mode;
    const current=()=>ticket===this.opening&&load.valid();
    try {
      await load.flushDraft();
      if(!current())return;
      const [messages,draft,cursor]=await Promise.all([
        load.memory??repo.cachedMessages(id),repo.drafts(id,'reply'),repo.disk.get<string>('cursor:'+id),
      ]);
      if(!current())return;
      load.cached(messages,draft,cursor);
      if(load.offline)return;
      if(load.live){
        const conversation=await repo.detail(id);
        if(!current())return;
        load.detail(conversation);
      }
      const page=await repo.history(id);
      if(!current())return;
      const all=await repo.cachedMessages(id);
      if(current())load.history(all,page.next_cursor);
    } catch(error){if(current())load.error(error);}
  }

  async changeMode(id:number,mode:'reply'|'note',repo:InboxRepository,load:{
    valid:()=>boolean;flushDraft:()=>Promise<void>;apply:(draft:string)=>void;
  }){
    const ticket=++this.mode;
    await load.flushDraft();
    if(ticket!==this.mode||!load.valid())return;
    const draft=await repo.drafts(id,mode);
    if(ticket===this.mode&&load.valid())load.apply(draft);
  }
}
