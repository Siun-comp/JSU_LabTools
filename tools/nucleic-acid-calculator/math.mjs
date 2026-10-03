// Decimal arithmetic derived from this project's dilution v0.3.0 arithmetic.
// Inputs and defined model constants are rational; physical MW is still a model.
export function q(n,d=1n){if(d<=0n||n<0n)throw Error('내부 수치 범위 오류');let a=n,b=d;while(b)[a,b]=[b,a%b];return {n:n/a,d:d/a};}
export const mul=(a,b)=>q(a.n*b.n,a.d*b.d);
export const div=(a,b)=>{if(!b.n)throw Error('0으로 나눌 수 없습니다.');return q(a.n*b.d,a.d*b.n);};
export const add=(a,b)=>q(a.n*b.d+b.n*a.d,a.d*b.d);
export const sub=(a,b)=>q(a.n*b.d-b.n*a.d,a.d*b.d);
export const pow=e=>e>=0?q(10n**BigInt(e)):q(1n,10n**BigInt(-e));
const cmp=(a,b)=>a.n*b.d-b.n*a.d;
export function decimal(value,label='값'){
 const s=String(value??'').trim(),m=/^\+?(\d+(?:\.\d*)?|\.\d+)(?:[eE]([+-]?\d+))?$/.exec(s);
 if(!m||s.length>64)throw Error(label+': 올바른 숫자를 입력하세요. 예: 25 또는 1E-3');
 const e=Number(m[2]||0),digits=m[1].replace('.','');
 if(Math.abs(e)>100||digits.length>40)throw Error(label+': 최대 40자리, 지수 −100~100 범위입니다.');
 return mul(q(BigInt(digits)),pow(e-(m[1].split('.')[1]||'').length));
}
export function positive(value,label){const r=decimal(value,label);if(!r.n)throw Error(label+': 0보다 커야 합니다.');return r;}
export function format(r,scientific=false){
 if(!r.n)return '0';let e=r.n.toString().length-r.d.toString().length;if(cmp(r,pow(e))<0n)e--;
 const scaled=mul(r,pow(11-e));let v=(scaled.n*2n+scaled.d)/(2n*scaled.d);
 if(v>=1000000000000n){v/=10n;e++;}const digits=v.toString().padStart(12,'0');
 if(scientific||cmp(r,pow(-3))<=0n||cmp(r,pow(12))>=0n)return digits[0]+'.'+digits.slice(1).replace(/0+$/,'').padEnd(2,'0')+'E'+e;
 const p=e+1;let s=p<=0?'0.'+'0'.repeat(-p)+digits:p>=digits.length?digits+'0'.repeat(p-digits.length):digits.slice(0,p)+'.'+digits.slice(p);
 return s.includes('.')?s.replace(/0+$/,'').replace(/\.$/,''):s;
}
// Readability summary only: fixed two decimals and signed exponent (min 2 digits).
// Exact calculations and the primary max-12-significant result remain intact.
export function copyScientific(r){
 if(!r||cmp(r,q(1000n))<0n)return null;
 let e=r.n.toString().length-r.d.toString().length;if(cmp(r,pow(e))<0n)e--;
 const scaled=mul(r,pow(2-e));let rounded=(scaled.n*2n+scaled.d)/(2n*scaled.d);
 if(rounded>=1000n){rounded/=10n;e++;}
 const digits=rounded.toString().padStart(3,'0');
 return digits[0]+'.'+digits.slice(1)+'E'+(e<0?'-':'+')+String(Math.abs(e)).padStart(2,'0');
}
