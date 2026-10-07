/** Edge-only back gestures keep vertical history scrolling and media controls independent. */
export type BackDirection=-1|1;
export function backDirection(startX:number,width:number):BackDirection|null{
 if(!Number.isFinite(startX)||!Number.isFinite(width)||width<56||startX<0||startX>width)return null;
 if(startX<=28)return 1;
 if(startX>=width-28)return -1;
 return null;
}
export function captureBack(direction:BackDirection|null,dx:number,dy:number,touches:number){
 return direction!==null&&touches===1&&direction*dx>=18&&Math.abs(dx)>Math.abs(dy)*2;
}
export function completeBack(direction:BackDirection,dx:number,dy:number,vx:number,width:number){
 const distance=direction*dx;
 return Math.abs(dy)<distance*.7&&(distance>=Math.min(120,Math.max(64,width*.22))||(distance>=48&&direction*vx>=.6));
}
