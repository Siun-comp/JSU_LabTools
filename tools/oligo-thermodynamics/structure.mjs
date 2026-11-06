// SPDX-License-Identifier: GPL-2.0-or-later
// Presentation only. Never changes or recalculates a THAL structure/energy.
export const STRUCTURE_FORMAT='thal-dot-bracket/1';
export const SUPPORTED_HAIRPIN='primer3-py 2.3.1 THAL / THL_GENERAL / maxLoop30';
export function parseHairpin(raw,sequence,model=SUPPORTED_HAIRPIN){
 const fail=reason=>({status:'unavailable',reason,raw,dotBracket:'',pairs:[]});
 if(model!==SUPPORTED_HAIRPIN)return fail('이 엔진 형식의 구조 변환을 검증하지 않았습니다.');
 if(typeof raw!=='string'||typeof sequence!=='string'||!/^[ACGT]+$/.test(sequence))return fail('서열 또는 구조 원문을 확인할 수 없습니다.');
 const lines=raw.replaceAll('\r\n','\n').split('\n');if(lines.at(-1)==='')lines.pop();
 if(lines.length!==2)return fail('예상한 두 줄의 THAL hairpin 형식이 아닙니다.');
 const symbols=/^SEQ\t([/\\-]+)$/.exec(lines[0]),bases=/^STR\t([ACGT]+)$/.exec(lines[1]);
 if(!symbols||!bases)return fail('THAL 라벨 또는 구조 기호를 확인할 수 없습니다.');
 if(bases[1]!==sequence||symbols[1].length!==sequence.length)return fail('반환 서열·구조 길이가 선택 가닥과 일치하지 않습니다.');
 const stack=[],pairs=[],out=[];
 for(let i=0;i<symbols[1].length;i++){
  const ch=symbols[1][i];
  if(ch==='/'){stack.push(i+1);out.push('(');}
  else if(ch==='\\'){
   const left=stack.pop();if(left===undefined)return fail('구조 괄호의 대응이 올바르지 않습니다.');
   pairs.push({left,right:i+1,bases:sequence[left-1]+'–'+sequence[i]});out.push(')');
  }else out.push('.');
 }
 if(stack.length||!pairs.length)return fail('구조 괄호의 대응 또는 염기쌍을 확인할 수 없습니다.');
 pairs.sort((a,b)=>a.left-b.left);
 return {status:'ok',format:STRUCTURE_FORMAT,sequence,dotBracket:out.join(''),pairs,raw};
}
export function readableStructure(raw,sequence,model,{includeRaw=true}={}){
 const s=parseHairpin(raw,sequence,model);
 if(s.status!=='ok')return `구조 표기 변환 불가: ${s.reason}\nTHAL 원문 (변경 없음):\n${raw}`;
 return [`구조 표기: ${s.format} · THAL 반환 구조의 표기 변환`,
  `seq  ${sequence}`,`str  ${s.dotBracket}`,
  '염기쌍 (독립 oligo · 1-based): '+s.pairs.map(p=>`${p.left}–${p.right} (${p.bases})`).join(', '),
  '( )는 염기쌍, .은 비결합 염기입니다. MFE·구조 확률을 계산한 값이 아닙니다.',
  ...(includeRaw?['THAL 원문 (변경 없음):',raw]:[])].join('\n');
}
export function escapeHTML(text){return String(text).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
export function textHTML(text){
 // Presentational font markup avoids style attributes: Chromium sanitizes HTML
 // clipboard data under the source page's strict style-src CSP as well.
 return '<div><pre><font face="Consolas" size="3">'+escapeHTML(text)+'</font></pre></div>';
}
