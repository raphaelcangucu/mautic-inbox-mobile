/** Native recognizers emit changing hypotheses, followed by committed segments. */
export class Transcript {
 private segments:string[]=[];
 private hypothesis='';
 constructor(private cumulative:boolean){}
 update(text:string,final:boolean){
  const clean=text.trim();
  if(this.cumulative){this.hypothesis=clean;return clean}
  if(final){if(clean)this.segments.push(clean);this.hypothesis=''}else this.hypothesis=clean;
  return [...this.segments,this.hypothesis].filter(Boolean).join(' ');
 }
}
export function speechLocale(language:string){return language==='en'?'en-US':language==='es'?'es-ES':'pt-BR'}
export function appendTranscript(draft:string,transcript:string){
 const text=[draft.trimEnd(),transcript.trim()].filter(Boolean).join('\n');
 if(text.length>4000)throw new Error('transcript_too_long');
 return text;
}
export function fileTranscriptionSupported(platform:string,version:number|string){return platform==='ios'||platform==='android'&&Number(version)>=33}
