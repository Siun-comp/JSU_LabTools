// SPDX-License-Identifier: GPL-2.0-or-later
import {PAIR_NAMES} from './pair-workbench-core.mjs';
import {entryStructureText} from './workbench-report.mjs';
import {display,conditionText} from './report.mjs';
const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
const button=(text,fn)=>{const b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;};
export function renderWorkbench(record,{onMetric=()=>{},onCopy=()=>{},selected='AB-heterodimer',onSelect=()=>{}}={}){
 const r=record.request,root=el('div',undefined,'pair-results');
 root.append(el('p',`${r.parent.name} · A ${r.selection.start}–${r.selection.end} (${r.strandA.length}nt) / B ${r.strandB.length}nt · ${new Date(record.calculatedAt).toLocaleTimeString('ko-KR')} 계산`,'result-origin'),
  el('p','입력 온도·이온 · Primer3 THAL 모델','pair-basis'),el('p',conditionText(r.conditions),'hint'),
  el('p',`Dimer API 농도 ${r.options.engineReferenceNm}nM · 실제 A/B 농도와 별도 / hairpin 농도 독립`,'pair-api-note'));
 const detail=el('details',undefined,'pair-structure-detail');detail.dataset.detail='pair:structure';const title=el('summary','반환 정렬·염기쌍 좌표');
 const select=el('select');select.setAttribute('aria-label','구조를 확인할 두 가닥 분석');
 const entries=[...record.entries,...record.referenceEntries];
 for(const e of entries){const o=el('option',(record.referenceEntries.includes(e)?'고정 PCR · ':'')+PAIR_NAMES[e.analysisId]);o.value=e.analysisId;select.append(o);}
 select.value=entries.some(e=>e.analysisId===selected)?selected:'AB-heterodimer';const content=el('div');
 function show(){const e=entries.find(e=>e.analysisId===select.value),v=e.calculation.thermodynamics;
  const metrics=v?el('p','ΔH '+display(v.dh)+' kcal/mol · ΔS '+display(v.ds)+' cal/(mol·K)','hint'):el('p','구조 미검출','hint');
  content.replaceChildren(metrics,el('pre',entryStructureText(e,r),'structure-text'),
  button('서열·구조·좌표 복사',()=>onCopy(record,e,false)),button('THAL 원문 복사',()=>onCopy(record,e,true)));onSelect(select.value);}
 select.addEventListener('change',show);detail.append(title,select,content);show();
 function table(entries,label,allMetrics=false){
  const scroll=el('div',undefined,'table-scroll pair-table-scroll'),t=el('table',undefined,'pair-table');t.append(el('caption',label));
  const head=el('thead'),row=el('tr');
  const metrics=[['ΔG kcal/mol','dg'],['Tm °C','tm']];if(allMetrics)metrics.push(['ΔH kcal/mol','dh'],['ΔS cal/(mol·K)','ds']);
  for(const [text,key] of [['반응',null],...metrics]){
   const th=el('th',text);if(key){const help=button('?',()=>onMetric(key));help.className='metric-help';help.setAttribute('aria-label',text+' 의미와 해석');th.append(help);}row.append(th);
  }head.append(row);t.append(head);const body=el('tbody');
  for(const e of entries){const v=e.calculation,tr=el('tr');tr.dataset.analysis=e.analysisId;
   const cell=el('th');cell.scope='row';cell.append(button(PAIR_NAMES[e.analysisId],()=>{select.value=e.analysisId;show();detail.open=true;title.focus();}));
   if(v.status==='no-structure')cell.append(el('span','구조 미검출','pair-status'));
   else if(v.mode===4)cell.append(el('span',v.structure?.status==='ok'?(v.structure.pairs.some(p=>p.right===v.request.strandA.length)?'3′ 끝 참여':'3′ 끝 미참여'):'구조 해석 불가','pair-status'));
   tr.append(cell);
   for(const [,key] of metrics){const td=el('td',v.status==='ok'?display(v.thermodynamics[key]):'—');td.dataset.metric=key;tr.append(td);}body.append(tr);
  }t.append(body);scroll.append(t);return scroll;
 }
 const main=record.entries.filter(e=>['A-hairpin','B-hairpin','AB-heterodimer'].includes(e.analysisId));
 root.append(table(main,'입력 조건 · A/B hairpin과 두 가닥 결합'));
 const secondary=el('details');secondary.dataset.detail='pair:secondary';
 secondary.append(el('summary','Self-dimer·선택한 3′ END'),table(record.entries.filter(e=>!main.includes(e)),'입력 조건 · self-dimer와 END'));root.append(secondary,detail);
 const applied=el('details');applied.dataset.detail='pair:applied';applied.append(el('summary','적용값·농도 관례·모델 한계'),
  el('p',`A 5′→3′ ${r.strandA}`,'pair-sequence'),el('p',`B 5′→3′ ${r.strandB}`,'pair-sequence'),
  el('p',`B: ${r.partner.mode==='manual'?'직접 입력 · 원본 좌표 없음':'완전상보 연동 · A 원본 좌표와 역방향 대응'} · ${r.partner.name||'이름 없음'}`),
  el('p','ANY/END는 THAL이 반환한 정렬입니다. 수동 B의 불일치를 특정 위치에 고정한 mismatch penalty 분석이 아닙니다.'),
  el('p','A/B가 같은 서열이면 두 입력을 별도 화학종으로 합산하지 않습니다. AA/BB는 각 oligo 두 사본의 모델 반응입니다.'),
  el('p','실제 A/B와 API 농도의 평균·합계·최솟값을 자동 대응하지 않습니다. 두 상태 로그 항의 대수적 대응만으로 대칭/경쟁 구조와 실제 혼합물 Tm을 보장할 수 없습니다.'));
 for(const text of record.limitations)applied.append(el('p',text));applied.append(el('p',`모델 ${r.contract.model}`),el('p',`manifest ${r.contract.manifest} / WASM ${r.contract.wasm}`,'hash-text'));root.append(applied);
 if(record.pcrReference){const ref=record.pcrReference,section=el('details',undefined,'pcr-reference-detail');section.dataset.detail='pair:pcr-reference';
  section.append(el('summary','별도 PCR 선별 참고 · 고정37°C/1M/API250nM'),
   el('p','위 입력 온도·이온의 모델값과 별도 계산입니다. 실제 반응 조건을 변경하지 않습니다.','pair-basis'),
   el('p',ref.status==='reference-computed'?`네 END 최소값: ${display(ref.minimumEndReference)} kcal/mol · ${PAIR_NAMES[ref.minimumComponent]}`:'네 END 모두 구조 미검출 · 최소값을0으로 만들지 않습니다.'),
   el('p','한정된 bisulfite-PCR 자료의 후향적 선별 참고입니다. AUC0.858은 정확도85.8%나 개별 발생 확률이 아닙니다. 무dimer cutoff·LAMP/Beacon/형광·실제Mg 에너지 정확도를 제공하지 않습니다.'),
   el('p',ref.evidenceScope==='outside-observed-length-range'?'입력 길이가 관측 자료의18~48nt 밖입니다. 계산 가능 범위와 실측 평가 범위는 다릅니다.':'관측 자료 길이18~48nt에 들어가도 다른 설계/실험 조건의 성능을 보장하지 않습니다.'));
  section.append(table(record.referenceEntries,'별도 고정 기준 · 네 END 구성값',true));
  const link=el('a','PrimerROC 원 논문');link.href='https://doi.org/10.1038/s41598-018-36612-9';link.target='_blank';link.rel='noopener noreferrer';section.append(link);root.append(section);
 }
 return root;
}
