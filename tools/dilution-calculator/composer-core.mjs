import {rational as Q,parseDecimal,format} from './core.mjs';
export const TOOL_VERSION='1.1.0',COMPOSER_VERSION='0.2.0';
const zero=Q(0n),one=Q(1n);
const mul=(a,b)=>Q(a.n*b.n,a.d*b.d),div=(a,b)=>{if(!b.n)throw Error('Stock 농도는 0보다 커야 합니다.');return Q(a.n*b.d,a.d*b.n);};
const add=(a,b)=>Q(a.n*b.d+b.n*a.d,a.d*b.d),cmp=(a,b)=>a.n*b.d-b.n*a.d;
const factors={M:['molar',one],mM:['molar',Q(1n,1000n)],uM:['molar',Q(1n,1000000n)],nM:['molar',Q(1n,1000000000n)],'g/L':['mass',one],'mg/mL':['mass',one],'mg/L':['mass',Q(1n,1000n)],'ug/mL':['mass',Q(1n,1000n)],'%w/v':['mass',Q(10n)],'%v/v':['vv',Q(1n,100n)],X:['X',one]};
const volumes={L:one,mL:Q(1n,1000n),uL:Q(1n,1000000n)};
export const UNITS=Object.keys(factors);
function number(s,label,positive=false){if(String(s??'').trim()==='')throw Error(label+'를 입력하세요.');const q=parseDecimal(s,label);if(positive&&!q.n)throw Error(label+'는 0보다 커야 합니다.');return q;}
function concentration(s,u,label){const f=factors[u];if(!f)throw Error('농도 단위를 확인하세요.');return {q:mul(number(s,label),f[1]),kind:f[0]};}
export function compose(batch,rows){
 const result={rows:[],errors:[],complete:false,makeup:'',version:TOOL_VERSION,algorithm:COMPOSER_VERSION};let V,fold,vf;
 try{vf=volumes[batch.unit];if(!vf)throw Error('부피 단위를 확인하세요.');V=mul(number(batch.volume,'최종 부피',true),vf);fold=number(batch.fold,'제조 농도',true);if(!rows.length)throw Error('성분을 추가하세요.');}catch(e){result.errors.push(e.message);return result;}
 let liquid=zero,vv=zero;
 for(const row of rows){
  const out={name:row.name,actual:'',amount:'',error:'',exact:null};result.rows.push(out);
  try{
   if(!row.name.trim())throw Error('시약명을 입력하세요.');
   const target=concentration(row.target,row.unit,'목표 농도');target.q=mul(target.q,fold);out.actual=format(mul(number(row.target,'목표 농도'),fold))+' '+row.unit;
   if(target.kind==='vv'){vv=add(vv,target.q);if(cmp(target.q,one)>0)throw Error('제조 농도가 100% v/v를 초과합니다.');}
   let amount,amountUnit;
   if(row.mode==='solid'){
    if(!['mass','molar'].includes(target.kind))throw Error('고체는 몰농도 또는 질량농도를 사용하세요.');
    amount=mul(V,target.q);if(target.kind==='molar'&&target.q.n)amount=mul(amount,number(row.mw,'MW',true));amountUnit='g';
   }else if(row.mode==='pure'){
    if(target.kind!=='vv')throw Error('액체 원액은 목표 농도를 %v/v로 입력하세요.');
    amount=mul(V,target.q);liquid=add(liquid,amount);amount=div(amount,vf);amountUnit=batch.unit;
   }else if(row.mode==='stock'){
    const stock=concentration(row.stock,row.stockUnit,'Stock 농도');if(!stock.q.n)throw Error('Stock 농도는 0보다 커야 합니다.');
    if(stock.kind==='vv'&&cmp(stock.q,one)>0)throw Error('Stock 농도가 100% v/v를 초과합니다.');
    if(stock.kind!==target.kind){if(!['mass','molar'].includes(stock.kind)||!['mass','molar'].includes(target.kind))throw Error('목표와 Stock의 농도 단위를 맞추세요.');const mw=number(row.mw,'몰↔질량 환산 MW',true);stock.q=target.kind==='mass'?mul(stock.q,mw):div(stock.q,mw);}
    if(cmp(target.q,stock.q)>0)throw Error('제조 농도가 Stock 농도보다 높습니다.');
    amount=mul(V,div(target.q,stock.q));liquid=add(liquid,amount);amount=div(amount,vf);amountUnit=batch.unit;
   }else throw Error('조제 방법을 선택하세요.');
   out.amount=format(amount)+' '+amountUnit;out.exact={n:String(amount.n),d:String(amount.d),unit:amountUnit};
  }catch(e){out.error=e.message;}
 }
 if(cmp(liquid,V)>0)result.errors.push('액체 사용량 합계가 최종 부피를 초과합니다.');
 if(cmp(vv,one)>0)result.errors.push('성분의 %v/v 합계가 100%를 초과합니다.');
 result.complete=!result.errors.length&&result.rows.every(r=>!r.error);
 result.makeup=(batch.solvent.trim()||'DW')+'로 최종 '+batch.volume+' '+batch.unit+'까지 맞추세요.';
 return result;
}
