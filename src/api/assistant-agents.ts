export type InternalAssistantAgent = {key:string;name:string;tools:string[];read_only:true;confirmation_required?:boolean};
export function checkedAssistantAgents(raw:unknown):InternalAssistantAgent[]{
  const data=raw as {items?:InternalAssistantAgent[]};
  if(!data||!Array.isArray(data.items))throw Error('Invalid assistant configuration');
  const seen=new Set<string>();
  for(const item of data.items){
    if(!item||typeof item.key!=='string'||item.key.length>80||typeof item.name!=='string'||!item.name.trim()||item.read_only!==true||!Array.isArray(item.tools)||!item.tools.every(tool=>typeof tool==='string')||seen.has(item.key))throw Error('Invalid assistant configuration');
    seen.add(item.key);
  }
  return data.items;
}
export function assistantHistoryKey(agentKey:string):string{return agentKey?`assistant:turns:${agentKey}`:'assistant:turns'};
export function chooseAssistantAgent(agents:InternalAssistantAgent[],saved:string|null|undefined):InternalAssistantAgent|null{
  return agents.find(agent=>agent.key===saved)??agents[0]??null;
}
