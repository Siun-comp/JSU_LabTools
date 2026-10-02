// Oligo Mix algorithm 0.3.0. Decimal input and unit factors use exact rational numbers.
export const VERSION = '0.3.0';
const MASS_EXP={g:9,mg:6,'µg':3,ng:0,pg:-3,fg:-6},VOLUME_EXP={L:6,mL:3,'µL':0};
export const MASS_CONCENTRATION_UNITS=Object.keys(MASS_EXP).flatMap(m=>Object.keys(VOLUME_EXP).map(v=>m+'/'+v));
export const MASS_AMOUNT_UNITS=Object.keys(MASS_EXP).map(m=>m+'/rxn');
export const MOLAR_UNITS=['mM','µM','nM','pM'];
export const COPY_CONCENTRATION_UNITS=['copies/L','copies/mL','copies/µL'];
export const COPY_AMOUNT_UNITS=['copies/rxn'];
export const STOCK_UNITS=[...MASS_CONCENTRATION_UNITS,...MOLAR_UNITS,...COPY_CONCENTRATION_UNITS];
export const TARGET_UNITS=[...MASS_AMOUNT_UNITS,...COPY_AMOUNT_UNITS,...STOCK_UNITS];
const gcd=(a,b)=>{a=a<0n?-a:a;while(b){[a,b]=[b,a%b];}return a;};
const q=(n,d=1n)=>{if(d===0n)throw Error('계산 분모가 0입니다.');if(d<0n){n=-n;d=-d;}const g=gcd(n,d);return {n:n/g,d:d/g};};
const add=(a,b)=>q(a.n*b.d+b.n*a.d,a.d*b.d);
const sub=(a,b)=>q(a.n*b.d-b.n*a.d,a.d*b.d);
const mul=(a,b)=>q(a.n*b.n,a.d*b.d);
const div=(a,b)=>q(a.n*b.d,a.d*b.n);
const cmp=(a,b)=>a.n*b.d-b.n*a.d;
function unitInfo(unit){
 if([...COPY_CONCENTRATION_UNITS,...COPY_AMOUNT_UNITS].includes(unit)){const volume=unit.split('/')[1];return {dimension:'copies',mode:volume==='rxn'?'amount':'concentration',factor:parse('1e'+(volume==='rxn'?0:-VOLUME_EXP[volume]),'단위')};}
 if(MOLAR_UNITS.includes(unit))return {dimension:'molar',mode:'concentration',factor:parse({mM:'1e3','µM':'1',nM:'1e-3',pM:'1e-6'}[unit],'단위')};
 const [mass,volume]=String(unit).split('/');
 if(!(mass in MASS_EXP)||(!(volume in VOLUME_EXP)&&volume!=='rxn'))throw Error('지원하지 않는 단위: '+unit);
 return {dimension:'mass',mode:volume==='rxn'?'amount':'concentration',factor:parse('1e'+(MASS_EXP[mass]-(volume==='rxn'?0:VOLUME_EXP[volume])),'단위')};
}
function molecularWeight(row,label){
 if(row.mwMethod==='direct'){const mw=parse(row.molecularWeight,label+' 분자량 g/mol');return {mw,note:`직접 입력 MW ${String(row.molecularWeight).trim()} g/mol`};}
 if(row.mwMethod==='dsdna650'){
  const length=String(row.lengthBp??'').trim();
  if(!/^\d+$/.test(length)||!Number.isSafeInteger(Number(length))||Number(length)<1)throw Error(label+': 전체 Plasmid 길이는 1 이상 안전한 정수 bp여야 합니다.');
  return {mw:mul(parse(length,label+' 길이'),q(650n)),note:`dsDNA 전체 ${length} bp × 650 g/mol/bp (근사)`};
 }
 throw Error(label+': 질량↔copies 환산에 분자량 직접 입력 또는 dsDNA 전체 길이 근사 방법을 선택하세요.');
}
function parse(value,label,zero=false){
 const s=String(value??'').trim();
 const m=s.match(/^([+]?)(\d+(?:\.\d*)?|\.\d+)(?:[eE]([+-]?\d+))?$/);
 if(!m||s.length>64)throw Error(label+': 숫자를 입력하세요.');
 const exponent=Number(m[3]||0),fraction=(m[2].split('.')[1]||'').length;
 if(Math.abs(exponent)>100||m[2].replace('.','').length>40)throw Error(label+': 최대 40자리, 지수 −100~100 범위입니다.');
 let n=BigInt(m[2].replace('.','')),d=1n;const power=exponent-fraction;
 if(power>=0)n*=10n**BigInt(power);else d=10n**BigInt(-power);
 if(n===0n&&!zero)throw Error(label+': 0보다 커야 합니다.');
 return q(n,d);
}
const sum=xs=>xs.reduce(add,q(0n));
function number(x){if(x.n===0n)return 0;const sign=x.n<0n?-1:1,a=(x.n<0n?-x.n:x.n).toString(),b=x.d.toString(),aa=a.slice(0,16),bb=b.slice(0,16);const v=sign*Number(`${(Number(aa)/10**(aa.length-1))/(Number(bb)/10**(bb.length-1))}e${a.length-b.length}`);if(!Number.isFinite(v)||v===0)throw Error('계산값이 표시 가능한 수치 범위를 벗어났습니다.');return v;}
export function format(value){if(!Number.isFinite(value))throw Error('유한 수치가 아닙니다.');return value===0?'0':String(Number(value.toPrecision(12)));}
// Screen presentation only; clipboard values and calculation precision remain unchanged.
export function displayFormat(value){
 if(!Number.isFinite(value))throw Error('유한 수치가 아닙니다.');
 if(value===0||Math.abs(value)>1e-3)return format(value);
 const [mantissa,exponent]=value.toExponential(11).split('e');
 const [whole,fraction]=mantissa.split('.');
 return whole+'.'+fraction.replace(/0+$/,'').padEnd(2,'0')+'E'+String(Number(exponent));
}
export function calculate(input){
 const rxn=parse(input.reaction,'최종 반응 부피'),mix=parse(input.mix,'반응당 Mix 부피');
 if(cmp(mix,rxn)>0n)throw Error('반응당 Mix 부피는 최종 반응 전체 부피를 초과할 수 없습니다.');
 const countText=String(input.count??'').trim(),count=Number(countText);
 if(!/^\d+$/.test(countText)||!Number.isSafeInteger(count)||count<1)throw Error('반응 수: 1 이상 안전한 정수를 입력하세요.');
 if(!Array.isArray(input.rows)||input.rows.length>15)throw Error('Oligo는 최대 15개입니다.');
 const n=q(BigInt(count)),rows=[];
 for(const [i,row] of input.rows.entries()){
  if(row.enabled===false)continue;
  const name=String(row.name??'').trim(),target=String(row.target??'').trim(),stock=String(row.stock??'').trim();
  if(!name&&!target&&!stock)continue;
  if(!name||!target||!stock)throw Error(`${i+1}행: 이름·목표 농도·Stock 농도를 모두 입력하세요.`);
  if(name.length>100)throw Error(`${i+1}행: 이름은 100자 이내입니다.`);
  const plasmid=row.type==='Plasmid';
  const targetUnit=row.targetUnit||'µM',stockUnit=row.stockUnit||'µM';
  if(!plasmid&&(targetUnit!=='µM'||stockUnit!=='µM'))throw Error(`${i+1}행: 다양한 단위는 Plasmid 성분에서 선택하세요.`);
  if(!TARGET_UNITS.includes(targetUnit)||!STOCK_UNITS.includes(stockUnit))throw Error(`${i+1}행: 지원하지 않는 목표/Stock 단위입니다.`);
  const tu=unitInfo(targetUnit),su=unitInfo(stockUnit);
  let conversionNote='',mixUnit=tu.dimension==='mass'?'ng/µL':tu.dimension==='copies'?'copies/µL':'µM';
  if(tu.dimension!==su.dimension){
   if(tu.dimension!=='copies'&&su.dimension!=='copies')throw Error(`${i+1}행: 질량 단위와 몰농도는 직접 환산할 수 없습니다. 두 입력을 같은 종류의 단위로 선택하세요.`);
   const na=parse('6.02214076e23','Avogadro 상수');let massFactor;
   if(tu.dimension==='mass'||su.dimension==='mass'){const basis=molecularWeight(row,`${i+1}행`);massFactor=div(mul(na,parse('1e-9','ng→g')),basis.mw);conversionNote=basis.note+'; copies는 Plasmid 분자 수 추정';}
   else conversionNote='Avogadro 상수 6.02214076e23 mol⁻¹; copies는 Plasmid 분자 수';
   for(const u of [tu,su]){if(u.dimension==='mass')u.factor=mul(u.factor,massFactor);else if(u.dimension==='molar')u.factor=mul(u.factor,mul(na,parse('1e-12','µM→mol/µL')));}
   mixUnit='copies/µL';
  }
  const ctInput=parse(target,`${i+1}행 목표 농도/반응당 양`),csInput=parse(stock,`${i+1}행 Stock 농도`),ct=mul(ctInput,tu.factor),cs=mul(csInput,su.factor);
  const dose=tu.mode==='amount'?ct:mul(ct,rxn),v=div(dose,cs);
  rows.push({name,type:row.type,target:number(ctInput),stock:number(csInput),targetUnit,stockUnit,perReaction:number(v),batch:number(mul(v,n)),mixConcentration:number(div(dose,mix)),mixUnit,conversionNote,_ct:ct,_cs:cs,_targetMode:tu.mode,_targetFactor:tu.factor,_batch:mul(v,n)});
 }
 if(!rows.length)throw Error('계산에 포함할 Oligo를 하나 이상 입력하세요.');
 const used=sum(rows.map(r=>div(r._batch,n))),te=sub(mix,used);
 if(te.n<0n)throw Error(`Stock 합계가 반응당 Mix 부피보다 ${format(number(q(-te.n,te.d)))} µL 큽니다. 부피 또는 목표 농도를 검토하세요.`);
 return {rows,reaction:number(rxn),mix:number(mix),count,te:number(te),batchTE:number(mul(te,n)),total:number(mul(mix,n)),_rxn:rxn,_mix:mix,_total:mul(mix,n)};
}
// Actual quantities are entered explicitly; no automatic rounding or hidden TE correction.
export function adjusted(result,volumes,teVolume){
 if(volumes.length!==result.rows.length)throw Error('실제 분주량 행 수가 다릅니다.');
 const amounts=volumes.map((v,i)=>parse(v,`${i+1}행 실제 전체 분주량`,true)),te=parse(teVolume,'실제 전체 TE 부피',true),total=sum([...amounts,te]);
 if(total.n===0n)throw Error('실제 전체 Mix 부피가 0입니다.');
 const rows=result.rows.map((r,i)=>{const dose=div(mul(mul(r._cs,amounts[i]),result._mix),total),achieved=r._targetMode==='amount'?dose:div(dose,result._rxn);return {name:r.name,volume:number(amounts[i]),achieved:number(div(achieved,r._targetFactor)),targetUnit:r.targetUnit,deviationPercent:number(mul(div(sub(achieved,r._ct),r._ct),q(100n)))};});
 const shortage=cmp(total,result._total)<0n?number(sub(result._total,total)):0;
 return {rows,te:number(te),total:number(total),shortage,ready:shortage===0};
}
export function checkPipette(volume,{step,min,max}){
 const v=parse(volume,'분주량',true),s=parse(step,'피펫 조정 간격'),lo=parse(min,'최소 분주량',true),hi=parse(max,'최대 분주량');
 if(cmp(lo,hi)>0n)throw Error('최소 분주량이 최대 분주량보다 큽니다.');
 if(v.n===0n)return {valid:true,note:'미분주 (0 µL)'};
 const ratio=div(v,s),range=cmp(v,lo)>=0n&&cmp(v,hi)<=0n;
 return {valid:range&&ratio.d===1n,note:!range?'설정한 1회 분주 범위 밖':ratio.d!==1n?'조정 간격의 배수가 아님':'설정 범위·간격 충족'};
}
