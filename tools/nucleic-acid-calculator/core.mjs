import {q,mul,div,add,sub,pow,decimal,positive} from './math.mjs';
export {format} from './math.mjs';
export const VERSION='0.2.1';
export const NA=q(602214076000000000000000n);
export const TYPES=['dsDNA','ssDNA','ssRNA','Plasmid'];
export const MOLAR_UNITS=['M','mM','µM','nM','pM','fM'];
export const VOLUMES=['L','mL','µL'];
export const MASSES=['g','mg','µg','ng','pg','fg'];
export const MASS_UNITS=MASSES.flatMap(m=>VOLUMES.map(v=>m+'/'+v));
export const COPY_UNITS=VOLUMES.map(v=>'copies/'+v);
// Factual reference constants: Biopython 1.88 IUPACData average monophosphates.
// Own implementation. See information page for sources and chemical convention.
const MONO={DNA:{A:'331.2218',C:'307.1971',G:'347.2212',T:'322.2085'},RNA:{A:'347.2212',C:'323.1965',G:'363.2206',U:'324.1813'}};
const WATER=decimal('18.0153'),PHOSPHATE=decimal('79.9799'); // H2O / HPO3, g/mol.
export function units(kind){if(kind==='mass')return MASS_UNITS;if(kind==='molar')return MOLAR_UNITS;if(kind==='copies')return COPY_UNITS;throw Error('농도 종류를 선택하세요.');}
function unitFactor(kind,unit){const list=units(kind);if(!list.includes(unit))throw Error('농도 종류에 맞는 단위를 선택하세요.');
 if(kind==='molar')return pow(-3*list.indexOf(unit));
 const [a,v]=unit.split('/'),ve=-3*VOLUMES.indexOf(v);return pow((kind==='mass'?-3*MASSES.indexOf(a):0)-ve);
}
export function parseSequence(raw,type){
 if(!TYPES.includes(type))throw Error('분자 종류를 선택하세요.');
 const text=String(raw??'');if(text.length>400000)throw Error('서열 입력은 최대 400,000문자입니다.');
 let header='',s='',seen=false,record=false;
 for(const line of text.split(/\r\n|\n|\r/)){
  const trimmed=line.replace(/^[ \t\f\v]+|[ \t\f\v]+$/g,'');if(!trimmed)continue;
  if(trimmed.startsWith('>')){if(record||seen)throw Error('한 분자의 서열만 입력하세요. 여러 FASTA 기록은 합치지 않습니다.');record=true;header=trimmed.slice(1);if(!header.trim())throw Error('FASTA 이름이 비어 있습니다. > 뒤에 이름을 입력하거나, 일반 서열만 입력하세요.');continue;}
  seen=true;s+=line.replace(/[ \t\f\v]/g,'');
 }
 if(!s)throw Error('계산할 서열이 없습니다.');if(s.length>200000)throw Error('계산 서열은 최대 200,000 nt/bp입니다.');
 const normalized=s.toUpperCase(),alphabet=type==='ssRNA'?'ACGU':'ACGT';
 for(let i=0;i<normalized.length;i++)if(!alphabet.includes(normalized[i])){
  const c=normalized[i];if(c==='/'||c==='['||c===']')throw Error('수정 표기는 일반 서열 MW에서 계산하지 않습니다. 해당 분자의 직접 MW를 사용하세요.');
  if(c==='T'&&type==='ssRNA'||c==='U'&&type!=='ssRNA')throw Error('선택한 DNA/RNA 종류와 서열 T/U가 다릅니다. 자동 변환하지 않습니다.');
  throw Error('서열 '+(i+1)+'번째 문자 '+JSON.stringify(s[i])+': 모호염기·숫자·기타 문자는 정밀 계산에서 지원하지 않습니다. 평균법 또는 직접 MW를 선택하세요.');
 }
 const counts=Object.fromEntries([...alphabet].map(b=>[b,0]));for(const b of normalized)counts[b]++;
 return {normalized,header,length:normalized.length,counts,formatNote:'ASCII 공백·줄바꿈은 계산에서 제외, 대소문자 무관 · 원문 보존'};
}
export function molecularWeight(i){
 if(!TYPES.includes(i.type))throw Error('분자 종류를 선택하세요.');
 if(!['','direct','average','sequence'].includes(i.method))throw Error('분자량 방법을 선택하세요.');
 if(i.method==='')return {mw:null,basis:'MW 미지정 · 같은 농도 단위 또는 몰↔Copy만 계산 가능'};
 if(i.method==='direct')return {mw:positive(i.mw,'전체 분자량 (g/mol)'),basis:'사용자 직접 입력 · 해당 전체 분자 기준',source:String(i.source??'').trim().slice(0,300)};
 if(i.method==='average'){
  const options=i.type==='ssDNA'?['330','303.7']:i.type==='ssRNA'?['340','320.5']:['650','660','607.4'];
  if(!options.includes(i.coefficient))throw Error('분자 종류에 맞는 평균 계수를 선택하세요.');
  const n=String(i.length??'').trim();if(!/^\d+$/.test(n)||n.length>9||BigInt(n)<1n||BigInt(n)>100000000n)throw Error('전체 길이는 1~100,000,000의 정수로 입력하세요.');
  const unit=i.type==='ssDNA'||i.type==='ssRNA'?'nt':'bp';
  const terminal={'303.7':'79.0','320.5':'159.0','607.4':'157.9'}[i.coefficient];
  const product=mul(q(BigInt(n)),decimal(i.coefficient));
  if(terminal){const condition=i.type==='ssRNA'?'5′ 삼인산 포함':i.type==='ssDNA'?'5′ 인산1개 포함':'말단 상수 포함';
   return {mw:add(product,decimal(terminal)),length:n,basis:'길이 평균 근사 · Thermo Fisher · ('+n+' '+unit+' × '+i.coefficient+' g/mol/'+unit+') + '+terminal+' g/mol · '+condition+' · 공식 고정 근사식'};}
  return {mw:product,length:n,basis:'길이 평균 근사 · '+n+' '+unit+' × '+i.coefficient+' g/mol/'+unit+' · '+(i.coefficient==='650'?'NEB':'Promega')+' 방법'};
 }
 const seq=parseSequence(i.sequence,i.type),rna=i.type==='ssRNA',ds=i.type==='dsDNA'||i.type==='Plasmid';
 if(!['linear','circular'].includes(i.topology)||rna&&i.topology!=='linear')throw Error('지원하는 구조를 선택하세요. RNA는 선형만 지원합니다.');
 if(i.topology==='linear'&&!['OH','P'].includes(i.ends))throw Error('선형 분자의 말단 조건을 선택하세요.');
 const alphabet=rna?'ACGU':'ACGT',comp=rna?{A:'U',U:'A',G:'C',C:'G'}:{A:'T',T:'A',G:'C',C:'G'};
 const totalCounts={...seq.counts};if(ds)for(const b of alphabet)totalCounts[b]+=seq.counts[comp[b]];
 let mw=q(0n);for(const b of alphabet)mw=add(mw,mul(q(BigInt(totalCounts[b])),decimal(MONO[rna?'RNA':'DNA'][b])));
 const strands=ds?2n:1n,bonds=BigInt(seq.length)*strands-(i.topology==='linear'?strands:0n);
 mw=sub(mw,mul(q(bonds),WATER));
 if(i.topology==='linear'&&i.ends==='OH')mw=sub(mw,mul(q(strands),PHOSPHATE));
 const detail=i.topology==='circular'?'완전 폐환·말단 없음':(ds?'두 가닥 각각 ':'')+(i.ends==='P'?'5′ 인산 / 3′ OH':'5′ OH / 3′ OH');
 return {mw,seq,length:String(seq.length),basis:'일반 서열 이론 MW · 무수 유리산·평균 질량 · '+(ds?'입력+완전 상보 가닥':'한 가닥')+' · '+detail+' · Biopython1.88 상수 기준',chemical:'무수 유리산·평균 질량; Na/기타 counterion·수화물·수정 제외'};
}
export function calculate(i){
 if(!TYPES.includes(i.type))throw Error('분자 종류를 선택하세요.');
 if(!MASS_UNITS.includes(i.massUnit)||!MOLAR_UNITS.includes(i.molarUnit)||!COPY_UNITS.includes(i.copyUnit))throw Error('결과 단위를 선택하세요.');
 const known=mul(decimal(i.value,'입력 농도'),unitFactor(i.kind,i.unit)),method=molecularWeight(i);
 let mass=null,molar=null,copies=null;
 if(i.kind==='mass'){mass=known;if(method.mw)molar=div(mass,method.mw);}
 else molar=i.kind==='molar'?known:div(known,NA);
 if(molar){copies=mul(molar,NA);if(method.mw)mass=mul(molar,method.mw);}
 return {input:{...i,value:String(i.value).trim(),sequence:i.method==='sequence'?String(i.sequence):'',source:i.method==='direct'?String(i.source??'').trim().slice(0,300):''},...method,mass:mass?div(mass,unitFactor('mass',i.massUnit)):null,molar:molar?div(molar,unitFactor('molar',i.molarUnit)):null,copies:copies?div(copies,unitFactor('copies',i.copyUnit)):null,algorithmVersion:VERSION};
}
