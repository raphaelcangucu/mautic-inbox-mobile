type Acceleration={x:number;y:number;z:number};
/** Three alternating impulses, rather than ordinary movement or rotating the phone. */
export class ShakeDetector{
 private previous:Acceleration|null=null;
 private axis:'x'|'y'|'z'='x';private sign=0;private count=0;private last=0;private cooldown=0;
 sample(value:Acceleration,now:number):boolean{
  const old=this.previous;this.previous=value;
  if(!old||now<this.cooldown)return false;
  const delta={x:value.x-old.x,y:value.y-old.y,z:value.z-old.z};
  const axis=(['x','y','z'] as const).reduce((a,b)=>Math.abs(delta[a])>Math.abs(delta[b])?a:b);
  if(Math.abs(delta[axis])<1.2||now-this.last<80)return false;
  const sign=Math.sign(delta[axis]);
  if(now-this.last>800||axis!==this.axis||sign===this.sign)this.count=0;
  this.axis=axis;this.sign=sign;this.last=now;
  if(++this.count<3)return false;
  this.count=0;this.previous=null;this.cooldown=now+2000;return true;
 }
}
