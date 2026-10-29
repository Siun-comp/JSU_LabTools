// SPDX-License-Identifier: GPL-2.0-or-later
import {display,STATUS,conditionText} from './report.mjs';
import {compareFragments} from './suite-core.mjs';
import {hasTm} from './analysis-core.mjs';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const titles={full:'선택 전체',five:'A5′ / B3′',three:'A3′ / B5′'};
export function renderSuite(suite,{selectedPoint=0,onSelect,duplexCard,hairpinCard}){
 const root=el('div',undefined,'suite-result'),r=suite.request,source=r.source;
 root.append(el('p',`${source.parent.name} · 원본 선택 ${source.selection.start}–${source.selection.end} (${source.selection.length} nt) · 말단 ${r.n} nt · ${new Date(suite.calculatedAt).toLocaleTimeString('ko-KR')} 계산`,'result-origin'),el('p',conditionText(source.conditions),'hint'));
 const overlap=Math.max(0,2*r.n-source.selection.length);
 root.append(el('p',`분리한 구간의 독립 duplex입니다. 전체 말단 풀림·속도가 아닙니다.${overlap?` 양 끝이 ${overlap} nt 겹칩니다.`:''}${r.n===source.selection.length?' 양 끝이 전체 선택과 같습니다.':''}`,'suite-caution'));
 function cards(point){
  const grid=el('div',undefined,'result-grid');
  for(let i=0;i<3;i++){
   const e=point.entries[i],t=r.targets[i],box=duplexCard(titles[e.kind],e.record);
   const context=el('details',undefined,'fragment-context');context.append(el('summary',`서열·좌표 · ${t.length} nt`),el('p',`A local ${t.aStart}–${t.aEnd} ↔ B local ${t.bStart}–${t.bEnd} · 원본 A ${t.parentStart}–${t.parentEnd}`,'hint'),el('code',`A 5′→3′ ${t.sequence}`),el('code',`B 5′→3′ ${t.partner}`),el('p',`반응 정의: ${t.sequence===t.partner?'자기상보':'비자기상보'} · 입력 A/B 농도를 독립 fragment에 적용`,'hint'));
   box.append(context);grid.append(box);
  }
  return grid;
 }
 function differences(point){const d=compareFragments(point.entries[1].record,point.entries[2].record),box=el('div',undefined,'end-difference');box.append(el('strong','말단 차이 · 5′−3′'),el('p',`ΔTm ${d.tm===null?'미제공':display(d.tm)+'°C'} / ΔΔG ${d.dg===null?'미제공':display(d.dg)+' kcal/mol'}`));if([d.tm,d.dg].some(v=>typeof v==='number'&&v!==0&&Math.abs(v)<=1e-8))box.append(el('p','1e-8 이하의 차이는 구현 대조 허용오차 수준입니다. 이 차이로 우열을 해석하지 마세요.','hint'));if(d.notes.length)box.append(el('p',d.notes.join(' '),'hint'));box.append(el('p','음의 ΔΔG는 같은 정의에서5′ fragment 형성이 유리한 방향입니다. Mg0 참고 자동 ΔΔG는 제공하지 않습니다.','hint'));return box;}
 if(r.mode==='terminal'){
  root.append(cards(suite.points[0]),differences(suite.points[0]));return root;
 }
 const summary=el('div',undefined,'scan-tm-summary');summary.append(el('strong','Duplex Tm 요약 · 고정 서열/조건에서 분석 온도와 무관'));
 for(const e of suite.points[0].entries)summary.append(el('p',`${titles[e.kind]}: ${hasTm(e.record.duplex)?display(e.record.duplex.tm)+'°C':STATUS[e.record.duplex.status]}`));root.append(summary);
 const reference=source.conditions.mg>0;
 root.append(el('p',reference?'아래 duplex 에너지는 Mg=0 참고값입니다. 입력 Mg 효과 제외·dNTP 독립 효과 미반영.':'아래 duplex 에너지는 입력 조건의 ΔG°(T)입니다.','suite-caution'));
 const scroll=el('div',undefined,'table-scroll scan-scroll'),table=el('table');table.className='scan-table';table.append(el('caption',reference?'온도별 Mg=0 참고 duplex ΔG° · kcal/mol':'온도별 입력 조건 duplex ΔG° · kcal/mol'));
 const head=el('thead'),headrow=el('tr');for(const title of ['보관 행','온도 °C','전체 ΔG°','5′ ΔG°','3′ ΔG°'])headrow.append(el('th',title));head.append(headrow);table.append(head);const body=el('tbody');
 for(let i=0;i<suite.points.length;i++){
  const p=suite.points[i],row=el('tr'),pick=el('input');pick.type='radio';pick.name='scan-point';pick.value=String(i);pick.checked=i===selectedPoint;pick.setAttribute('aria-label',`${p.temperature}°C 온도행 선택`);pick.addEventListener('change',()=>onSelect(i));const cell=el('td');cell.append(pick);row.append(cell,el('td',String(p.temperature)));
  for(const e of p.entries){const v=reference?e.record.duplexMgZeroReference.result:e.record.duplex;row.append(el('td',v.status==='ok'?display(v.dg):STATUS[v.status]));}body.append(row);
 }
 table.append(body);scroll.append(table);root.append(scroll,el('p','표는 결합률·형광·용융곡선이 아닙니다. 보관할 행을 선택해도 공통 입력 온도는 바뀌지 않습니다.','hint'));
 if(r.includeHairpin){
  const hs=el('div',undefined,'table-scroll scan-scroll'),ht=el('table');ht.append(el('caption','입력 조건 · 전체 A/B hairpin ΔG°(T) · kcal/mol · 위 Mg0 duplex와 직접 빼지 않음'));const hr=el('tr');for(const t of ['온도 °C','A hairpin ΔG°','B hairpin ΔG°'])hr.append(el('th',t));const hh=el('thead');hh.append(hr);ht.append(hh);const hb=el('tbody');for(const point of suite.points){const row=el('tr');row.append(el('td',String(point.temperature)));for(const key of ['hairpinA','hairpinB']){const v=point.entries[0].record[key];row.append(el('td',v.status==='ok'?display(v.dg):STATUS[v.status]));}hb.append(row);}ht.append(hb);hs.append(ht);root.append(hs);
 }else root.append(el('p','전체 A/B hairpin: 미요청. 옵션을 켜고 온도 비교를 다시 실행하면 계산합니다.','hint'));
 const p=suite.points[selectedPoint],detail=el('details');detail.dataset.detail='scan-selected';detail.append(el('summary',`선택한 ${p.temperature}°C의 수치·조건·구조`),cards(p),differences(p));
 if(r.includeHairpin){const hp=el('div',undefined,'result-grid hairpin-grid');hp.append(hairpinCard('A hairpin · 전체',p.entries[0].record,'hairpinA'),hairpinCard('B hairpin · 전체',p.entries[0].record,'hairpinB'));detail.append(hp);}root.append(detail);
 return root;
}
