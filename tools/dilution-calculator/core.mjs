// Independent dilution arithmetic. Decimal inputs remain exact rational values.
export const VERSION = '0.3.0';
export const MOLAR_UNITS = ['M', 'mM', 'µM', 'nM', 'pM', 'fM'];
export const MOLAR_AMOUNT_UNITS = ['mol', 'mmol', 'µmol', 'nmol', 'pmol', 'fmol'];
export const VOLUME_UNITS = ['µL', 'mL', 'L'];
const massExponent = {g:0, mg:-3, 'µg':-6, ng:-9, pg:-12, fg:-15};
export const MASS_AMOUNT_UNITS = Object.keys(massExponent);
const volumeExponent = {L:0, mL:-3, 'µL':-6};
export const MASS_UNITS = Object.keys(massExponent).flatMap(m => VOLUME_UNITS.map(v => m + '/' + v));
export function unitsFor(family) {
  if (family === 'molar') return MOLAR_UNITS;
  if (family === 'mass') return MASS_UNITS;
  if (family === 'mixed') return [...MOLAR_UNITS,...MASS_UNITS];
  throw Error('농도 종류를 선택하세요.');
}
function gcd(a,b) { while(b) [a,b] = [b,a%b]; return a; }
export function rational(n,d=1n) {
  if(d<=0n || n<0n) throw Error('내부 계산 범위 오류입니다.');
  const g=gcd(n,d); return {n:n/g,d:d/g};
}
const mul=(a,b)=>rational(a.n*b.n,a.d*b.d);
const div=(a,b)=>{if(!b.n) throw Error('0으로 나눌 수 없습니다.'); return rational(a.n*b.d,a.d*b.n);};
const cmp=(a,b)=>a.n*b.d-b.n*a.d;
const sub=(a,b)=>rational(a.n*b.d-b.n*a.d,a.d*b.d);
const pow=e=>e>=0?rational(10n**BigInt(e)):rational(1n,10n**BigInt(-e));
export function parseDecimal(value,label='값') {
  const text=String(value??'').trim();
  const m=/^\+?(\d+(?:\.\d*)?|\.\d+)(?:[eE]([+-]?\d+))?$/.exec(text);
  if(!m || text.length>64) throw Error(label+': 숫자를 입력하세요. 예: 25 또는 1E-3');
  const exponent=Number(m[2]||0), digits=m[1].replace('.','');
  if(Math.abs(exponent)>100 || digits.length>40) throw Error(label+': 최대 40자리, 지수 −100~100 범위입니다.');
  const decimal=(m[1].split('.')[1]||'').length;
  const n=BigInt(digits), factor=pow(exponent-decimal);
  return mul(rational(n),factor);
}
function unitInfo(unit,kind='concentration') {
  if(kind==='amount') {
    if(MOLAR_AMOUNT_UNITS.includes(unit)) return {family:'molar',factor:pow(-3*MOLAR_AMOUNT_UNITS.indexOf(unit))};
    if(MASS_AMOUNT_UNITS.includes(unit)) return {family:'mass',factor:pow(massExponent[unit])};
  }else if(kind==='concentration') {
    if(MOLAR_UNITS.includes(unit)) return {family:'molar',factor:pow(-3*MOLAR_UNITS.indexOf(unit))};
    if(MASS_UNITS.includes(unit)) {const [mass,volume]=unit.split('/');return {family:'mass',factor:pow(massExponent[mass]-volumeExponent[volume])};}
  }
  throw Error('지원하는 계산 종류와 단위를 선택하세요.');
}
function dilutionUnit(family,unit) {
  if(!unitsFor(family).includes(unit))throw Error('선택한 농도 종류의 지원 단위를 사용하세요.');
  return unitInfo(unit);
}
function positive(value,label) {
  const q=parseDecimal(value,label);
  if(!q.n) throw Error(label+': 0보다 커야 합니다.');
  return q;
}
export function format(q) {
  if(!q.n) return '0';
  let e=q.n.toString().length-q.d.toString().length;
  if(cmp(q,pow(e))<0n) e--;
  const scale=pow(11-e), a=mul(q,scale);
  let mantissa=(a.n*2n+a.d)/(2n*a.d); // 12 significant digits, round half up.
  if(mantissa>=1000000000000n) {mantissa/=10n;e++;}
  let digits=mantissa.toString().padStart(12,'0');
  const scientific=cmp(q,pow(-3))<=0n || cmp(q,pow(12))>=0n;
  if(scientific) {
    const tail=digits.slice(1).replace(/0+$/,'').padEnd(2,'0');
    return digits[0]+'.'+tail+'E'+e;
  }
  const point=e+1;
  let text=point<=0?'0.'+'0'.repeat(-point)+digits:point>=digits.length?digits+'0'.repeat(point-digits.length):digits.slice(0,point)+'.'+digits.slice(point);
  if(text.includes('.')) text=text.replace(/0+$/,'').replace(/\.$/,'');
  return text;
}
export function calculate(input) {
  if(!['final','all'].includes(input.mode)) throw Error('계산 모드를 선택하세요.');
  if(!VOLUME_UNITS.includes(input.volumeUnit)) throw Error('부피 단위를 선택하세요.');
  const su=dilutionUnit(input.family,input.stockUnit),tu=dilutionUnit(input.family,input.targetUnit);
  let stock=mul(positive(input.stock,'Stock 농도'),su.factor);
  const target=parseDecimal(input.target,'목표 농도');
  if(!target.n) throw Error('목표 농도 0에는 유한 부피의 희석으로 도달할 수 없습니다.');
  let goal=mul(target,tu.factor),mw=null;
  if(su.family!==tu.family){
    mw=positive(input.molecularWeight,'분자량 (g/mol)');
    if(su.family==='mass')stock=div(stock,mw);
    if(tu.family==='mass')goal=div(goal,mw);
  }
  if(cmp(goal,stock)>0n) throw Error('목표 농도가 Stock보다 높습니다. 희석만으로 만들 수 없습니다.');
  const known=positive(input.volume,input.mode==='final'?'최종 부피':'보유 Stock 부피');
  const factor=div(stock,goal);
  const stockVolume=input.mode==='final'?div(known,factor):known;
  const finalVolume=input.mode==='final'?known:mul(known,factor);
  return {input:{mode:input.mode,family:input.family,stock:String(input.stock).trim(),stockUnit:input.stockUnit,target:String(input.target).trim(),targetUnit:input.targetUnit,volume:String(input.volume).trim(),volumeUnit:input.volumeUnit,molecularWeight:mw?String(input.molecularWeight).trim():null},stockVolume,diluentVolume:sub(finalVolume,stockVolume),finalVolume,factor,mw,normalizedStock:stock,normalizedTarget:goal,normalizedUnit:mw?'mol/L':su.family==='mass'?'g/L':'mol/L',algorithmVersion:VERSION};
}
export function convert(input) {
  if(!['concentration','amount'].includes(input.kind))throw Error('농도 또는 총량을 선택하세요.');
  if(!['molar-to-mass','mass-to-molar'].includes(input.direction))throw Error('환산 방향을 선택하세요.');
  const su=unitInfo(input.inputUnit,input.kind),ou=unitInfo(input.outputUnit,input.kind);
  const source=input.direction==='molar-to-mass'?'molar':'mass';
  if(su.family!==source || ou.family===source)throw Error('환산 방향에 맞는 입력·출력 단위를 선택하세요.');
  const value=parseDecimal(input.value,'환산할 값'),mw=positive(input.molecularWeight,'분자량 (g/mol)');
  const base=mul(value,su.factor),converted=source==='molar'?mul(base,mw):div(base,mw);
  return {input:{kind:input.kind,direction:input.direction,value:String(input.value).trim(),inputUnit:input.inputUnit,outputUnit:input.outputUnit,molecularWeight:String(input.molecularWeight).trim()},value:div(converted,ou.factor),mw,algorithmVersion:VERSION};
}
export function prepare(input) {
  if(!['mass','volume'].includes(input.mode))throw Error('시약 조제 모드를 선택하세요.');
  if(!MOLAR_UNITS.includes(input.concentrationUnit))throw Error('목표 몰농도 단위를 선택하세요.');
  const concentration=mul(positive(input.concentration,'목표 몰농도'),unitInfo(input.concentrationUnit).factor);
  const mw=positive(input.molecularWeight,'분자량 (g/mol)');
  let value;
  if(input.mode==='mass'){
    if(!VOLUME_UNITS.includes(input.knownUnit)||!MASS_AMOUNT_UNITS.includes(input.outputUnit))throw Error('최종 부피·질량 단위를 선택하세요.');
    const volume=mul(positive(input.known,'최종 부피'),pow(volumeExponent[input.knownUnit]));
    value=div(mul(mul(concentration,volume),mw),pow(massExponent[input.outputUnit]));
  }else{
    if(!MASS_AMOUNT_UNITS.includes(input.knownUnit)||!VOLUME_UNITS.includes(input.outputUnit))throw Error('보유 질량·최종 부피 단위를 선택하세요.');
    const mass=mul(positive(input.known,'보유 질량'),pow(massExponent[input.knownUnit]));
    value=div(div(mass,mul(concentration,mw)),pow(volumeExponent[input.outputUnit]));
  }
  return {input:{mode:input.mode,concentration:String(input.concentration).trim(),concentrationUnit:input.concentrationUnit,molecularWeight:String(input.molecularWeight).trim(),known:String(input.known).trim(),knownUnit:input.knownUnit,outputUnit:input.outputUnit},value,mw,algorithmVersion:VERSION};
}
