export function suppressNotification(state:{active:{id:string}|null;route:string;conversationId:number;preferences:{suppressOpen?:boolean}},data:Record<string,unknown>){
 return state.preferences.suppressOpen!==false&&state.route==='chat'&&state.active?.id===data.accountId&&state.conversationId===Number(data.conversationId);
}
