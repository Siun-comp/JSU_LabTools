// Deterministic synthetic mapping dataset with base-level truth. No real sequence data.
export function rng(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
const B='ACGT';
export function randomSeq(r,n){let s='';for(let i=0;i<n;i++)s+=B[r()*4|0];return s;}
export const rc=s=>{const c={A:'T',C:'G',G:'C',T:'A',N:'N'};let o='';for(let i=s.length-1;i>=0;i--)o+=c[s[i]];return o;};
function poisson(r,l){const L=Math.exp(-l);let k=0,p=1;do{k++;p*=r();}while(p>L);return k-1;}
// strain = {b:array of chars, m:array of ref positions (-1 = inserted base)}
function clone(s){return {b:s.b.slice(),m:s.m.slice()};}
function sub(r,s,i){const o=s.b[i];let n;do{n=B[r()*4|0];}while(n===o);s.b[i]=n;}
function mutate(r,s,subs,indels){
 for(let k=0;k<subs;k++)sub(r,s,r()*s.b.length|0);
 for(let k=0;k<indels;k++){const p=20+(r()*(s.b.length-40)|0),len=1+(r()*3|0)*(r()<.5?3:1);
  if(r()<.5){s.b.splice(p,len);s.m.splice(p,len);}else{const ins=randomSeq(r,len);s.b.splice(p,0,...ins);s.m.splice(p,0,...Array(len).fill(-1));}}
}
export function makeDataset(o){const g=stream(o);const ref=g.next().value,records=[...g];return {ref,records};}
export function* stream({n,refLength=1841,seed=1}){
 const r=rng(seed),ref=randomSeq(r,refLength);yield ref;
 const root={b:[...ref],m:[...ref].map((_,i)=>i)},clades=[];
 for(let i=0;i<12;i++){const c=clone(root);mutate(r,c,Math.round(refLength*(.01+r()*.05)),r()*3|0);clades.push(c);}
 const pool=[];
 for(let i=0;i<n;i++){
  const x=r();let cat='normal';
  if(x<.12)cat='partial';else if(x<.17)cat='short';else if(x<.20)cat='divergent';else if(x<.21)cat='unrelated';else if(x<.26)cat='nrun';
  let s;
  if(cat==='unrelated')s={b:[...randomSeq(r,600+(r()*1000|0))],m:null};
  else if(pool.length&&cat==='normal'&&r()<.3){s=pool[r()*pool.length|0];cat='duplicate';}
  else{s=clone(clades[r()*clades.length|0]);
   if(cat==='divergent'){const rate=.15+r()*.10;mutate(r,s,Math.round(s.b.length*rate),4+(r()*6|0));}
   else mutate(r,s,poisson(r,3),r()<.08?1:0);
   if(cat==='normal'&&pool.length<Math.min(4000,8e6/refLength))pool.push(s);}
  let st=0,en=s.b.length;
  if(cat==='partial'){const l=300+(r()*(s.b.length-300)|0);st=r()*(s.b.length-l)|0;en=st+l;}
  if(cat==='short'){const l=50+(r()*151|0);st=r()*(s.b.length-l)|0;en=st+l;}
  let b=s.b.slice(st,en),m=s.m?s.m.slice(st,en):null;
  if(cat==='nrun'){b=b.slice();const l=5+(r()*40|0),p=r()*(b.length-l)|0;for(let j=0;j<l;j++)b[p+j]='N';}
  const seqF=b.join(''),reverse=r()<.08;
  yield {name:`syn${i+1}|${cat}`,cat,seq:reverse?rc(seqF):seqF,reverse,map:m};
 }
}
export function toFasta(name,seq){return `>${name}\n${seq}\n`;}
