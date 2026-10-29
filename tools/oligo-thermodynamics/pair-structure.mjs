// SPDX-License-Identifier: GPL-2.0-or-later
// Interpret the unchanged THAL drawing; never infer a different alignment.
export function parsePairStructure(raw, strandA, strandB, mode = 1) {
  const unavailable = reason => ({status:'unavailable', reason, raw, pairs:[]});
  if (![1,2,3].includes(mode) || !/^[ACGT]{2,60}$/.test(strandA) || !/^[ACGT]{2,60}$/.test(strandB) || typeof raw !== 'string') return unavailable('Unsupported input or mode');
  const lines = raw.replaceAll('\r\n','\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  if (lines.length !== 4) return unavailable('Expected four THAL dimer rows');
  const labels = ['SEQ\t','SEQ\t','STR\t','STR\t'];
  if (lines.some((line,i) => !line.startsWith(labels[i]))) return unavailable('Unknown THAL row labels');
  const rows = lines.map((line,i) => line.slice(labels[i].length));
  if (rows.some(row => !/^[ ACGT-]*$/.test(row))) return unavailable('Unexpected drawing character');
  const width = Math.max(...rows.map(row=>row.length));
  const padded = rows.map(row=>row.padEnd(width,' '));
  const topInput = mode === 3 ? strandB : strandA;
  const bottomInput = mode === 3 ? strandA : strandB;
  let top = '', bottom = '', topIndex = 0, bottomIndex = 0;
  const pairs = [];
  for (let i=0; i<width; i++) {
    const chars = padded.map(row=>row[i]);
    const bases = chars.map(ch=>/[ACGT]/.test(ch));
    if ((bases[0] && bases[1]) || (bases[2] && bases[3]) || bases[1] !== bases[2]) return unavailable('Drawing columns do not define a paired alignment');
    const a = bases[0] ? chars[0] : bases[1] ? chars[1] : '';
    const b = bases[2] ? chars[2] : bases[3] ? chars[3] : '';
    if (a) {top += a; topIndex++;}
    if (b) {bottom += b; bottomIndex++;}
    if (bases[1]) {
      const apos = mode === 3 ? strandA.length-bottomIndex+1 : topIndex;
      const bpos = mode === 3 ? topIndex : strandB.length-bottomIndex+1;
      pairs.push({a:apos,b:bpos,bases:strandA[apos-1]+'–'+strandB[bpos-1],
        watsonCrick:['AT','TA','GC','CG'].includes(strandA[apos-1]+strandB[bpos-1])});
    }
  }
  if (top !== topInput || bottom !== [...bottomInput].reverse().join('')) return unavailable('Drawing does not round-trip to the two original 5-prime sequences');
  pairs.sort((a,b)=>a.a-b.a);
  if (!pairs.length || pairs.some((p,i)=>p.a<1 || p.a>strandA.length || p.b<1 || p.b>strandB.length || (i && (p.a<=pairs[i-1].a || p.b>=pairs[i-1].b)))) return unavailable('Duplicate or crossing pair coordinates');
  return {status:'ok',format:'thal-pair-coordinates/1',coordinateBasis:'each-input-5to3-1based',
    topStrand:mode===3?'B':'A',bottomStrand:mode===3?'A':'B',
    topDirection:'5to3',bottomDirection:'3to5',rows,pairs,raw,
    terminalPair:{a3:pairs.some(p=>p.a===strandA.length),b3:pairs.some(p=>p.b===strandB.length)}};
}

export function readablePairStructure(structure, strandA, strandB) {
  const head = [`A 5′→3′ ${strandA}`,`B 5′→3′ ${strandB}`,
    'Primer3 반환 정렬의 표기이며 실제 유일 구조·고정 mismatch·구조 확률이 아닙니다.'];
  if (structure.status !== 'ok') return [...head,'구조 해석 불가: '+structure.reason,'THAL 원문:',structure.raw||''].join('\n');
  return [...head,'좌표: 각 입력 5′→3′ 기준, 1-based',
    ...structure.pairs.map(p=>`A:${p.a}\tB:${p.b}\t${p.bases}${p.watsonCrick?'':' (non-Watson-Crick)'}`),
    `원문 위 가닥 ${structure.topStrand} 5′→3′ / 아래 가닥 ${structure.bottomStrand} 3′→5′`,
    'THAL 원문 (변경 없음):',structure.raw].join('\n');
}
