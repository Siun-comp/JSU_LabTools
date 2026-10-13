import {analyses,comparisonFacts,olsDiagnostics,METHODS,SOURCES} from './comparison.mjs';
import {demingSpecimen} from './practical-data.mjs';
import {baObservation} from './ba-observation.mjs';
import {summarize,evaluateRow,HEADERS,numericCaution} from './core.mjs';
import {formatNumber as fmt,formatPercent as pct,numberFormat} from './format.mjs';
export {fmt,pct};
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const ci=v=>v?.map(fmt).join(' ~ ')||'—';
export const table=(headers,rows)=>`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
export const details=(title,body)=>`<details class="interpretation"><summary>${esc(title)}</summary>${body}</details>`;
export const num=value=>({value,format:numberFormat(value)});
export const ANALYSIS_NAMES={qual:'정성 비교',numeric:'수치 관계·PI',groups:'구간별 분석',median:'중앙값 분석',ba:'BA·직접 차이',rows:'검체 목록'};
export const equalityAvailable=c=>c.sameScale===true&&Boolean(c.xUnit)&&c.xUnit===c.yUnit;
export const baPrecisionNote=b=>b.n===2?'수치쌍이 2개뿐입니다. LoA를 계산할 수 있어도 안정된 일치한계로 해석하기 어렵습니다. LoA 끝점의 CI와 검체 수를 함께 확인하세요.':b.loa?'LoA는 표본에서 추정한 한계입니다. 검체 수와 LoA 끝점의 CI로 한계 추정의 불확실성을 함께 확인하세요.':'';
export const demingCaution='적용 범위에서 각 축의 측정오차 분산이 일정하다고 가정합니다. 값이 커질수록 퍼짐이 넓어지면 이 가정을 재검토하세요. λ 추정의 불확실성은 계수 CI에 포함하지 않습니다.';
export function resultContract(snapshot,selected,view={}){
  const method=view.method==='deming'?'deming':'ols',r=analyses(snapshot,selected),s=summarize(selected,snapshot.confidence,snapshot.method,snapshot.model);
  const range=rows=>{const p=rows.filter(v=>v.pair);return p.length?`Reference ${fmt(Math.min(...p.map(v=>v.x)))} ~ ${fmt(Math.max(...p.map(v=>v.x)))} / Product ${fmt(Math.min(...p.map(v=>v.y)))} ~ ${fmt(Math.max(...p.map(v=>v.y)))}`:'수치쌍 없음';};
  return {snapshot,selected,summary:s,...r,method,overlay:method==='deming'&&view.overlay===true,equality:method==='deming'&&view.equality===true&&equalityAvailable(r.config),model:snapshot.model,level:snapshot.confidence*100,modelRange:range(snapshot.rows),selectedRange:range(selected),diagnostics:()=>olsDiagnostics(snapshot.model),facts:purpose=>comparisonFacts(r).filter(([k])=>purpose==='ba'?!k.startsWith('Deming'):purpose==='deming'?k.startsWith('Deming')||k==='독립 검체 확인':false)};
}
export function numericRows(r,detail=false){
  const m=r.method==='deming'?r.deming:r.model;
  const out=[['회귀 방법',r.method==='deming'?'일반 Deming':'OLS'],['모델 대상','전체 적격 양성 수치쌍 고정 — 필터 재적합 없음'],['전체 모델 n',r.model.n],['현재 선택 수치쌍 n',r.selectedN],['전체 관측 범위',r.modelRange],['현재 선택 관측 범위',r.selectedRange],['Pearson r',num(r.model.r)],['Pearson r CI 하한',num(r.model.rCI?.[0]??null)],['Pearson r CI 상한',num(r.model.rCI?.[1]??null)],['회귀식',m?.slope==null?'계산 불가':`Product = ${fmt(m.intercept)} + ${fmt(m.slope)} × Reference`]];
  if(r.method==='deming')out.push(...r.facts('deming'),['Reference 단위/척도',r.config.xUnit||'미입력'],['Product 단위/척도',r.config.yUnit||'미입력'],['기울기',num(m?.slope??null)],['기울기 CI 하한',num(m?.slopeCI?.[0]??null)],['기울기 CI 상한',num(m?.slopeCI?.[1]??null)],['절편',num(m?.intercept??null)],['절편 CI 하한',num(m?.interceptCI?.[0]??null)],['절편 CI 상한',num(m?.interceptCI?.[1]??null)],['OLS 회귀선 중첩',r.overlay?'ON':'OFF'],['Y=X 기준선',r.equality?'ON — 동일 항목·단위·결과 정의 확인':'OFF']);
  out.push(['별도 OLS PI 기준',`전체 고정 OLS / PI ${r.snapshot.piLevel*100}%`],['OLS PI 이탈 / 계산 가능',`${r.summary.pi.outliers} / ${r.summary.pi.n}`],['OLS PI 계산 불가',r.summary.pi.unavailable],['해석','상관·직선 관계는 직접 일치나 동등성 입증이 아님. PI 이탈은 자동 제외 사유 아님']);
  if(detail)out.push(...(r.method==='deming'?[['기울기 jackknife SE',num(m?.slopeSE??null)],['절편 jackknife SE',num(m?.interceptSE??null)]]:[['OLS 기울기 CI',ci(m.slopeCI)],['OLS 절편 CI',ci(m.interceptCI)],['R²',num(m.r2)],['잔차 표준오차',num(m.se)]]));
  return out;
}
export function numericIntro(r){const duplicates=r.snapshot.rows.filter(p=>p.issues.some(v=>v.includes('중복'))).length;return `<h2>수치 관계 · ${r.method==='deming'?'Deming':'OLS·PI'}</h2><p>두 수치의 직선 관계를 확인합니다. Reference는 X, Product는 Y입니다. 높은 상관은 같은 값이나 대체 가능성을 뜻하지 않습니다.</p><p class="hint">각 행은 독립 검체의 한 쌍이어야 합니다. 같은 검체의 반복 행을 독립 검체 수로 세지 마세요.</p><p>전체 모델 n=${r.model.n} · 현재 선택 수치쌍 n=${r.selectedN}<br>전체: ${esc(r.modelRange)}<br>선택: ${esc(r.selectedRange)}</p>`+(duplicates?`<p class="warning">전체 입력의 중복 ID 표시 ${duplicates}행은 합치지 않고 보존합니다. 같은 검체의 반복측정이면 독립 검체 모형을 사용하지 마세요. ID만으로 반복 설계를 확인할 수 없습니다.</p>`:'')+(r.selectedN===0?'<p class="warning">현재 선택 범위에 수치쌍이 없습니다. 전체 모델이 있어도 선택 검체 결과는 없습니다.</p>':'')+[numericCaution(r.model.n),r.selectedN!==r.model.n?numericCaution(r.selectedN):''].filter(Boolean).map(t=>`<p class="warning">${esc(t)}</p>`).join('');}
export function olsSummary(r){const p=r.summary.pi;return `<p class="finding">별도 OLS 기준 PI 검토: 이탈 ${p.outliers} / 계산 가능 ${p.n}개 · 계산 불가 ${p.unavailable}개 · 전체 OLS ${r.snapshot.piLevel*100}% PI. 직선을 만든 자료에서 확인한 탐색 결과이며 새 검체 오류율이 아닙니다. 이탈은 자동 제외 사유가 아닙니다.</p>`;}
export const demingAssumptions='일반 Deming은 독립 검체·선형 관계·평균 0의 측정오차·두 축 오차의 독립성·각 축의 일정한 측정오차 분산과 지정 λ를 가정합니다. λ 자체의 불확실성은 계수 CI에 포함하지 않습니다. 계수 CI는 OLS PI가 아닙니다.';
export const olsAssumptions='OLS는 관측 Reference를 설명변수로 사용합니다. 독립성·선형 관계·일정한 잔차 분산을 검토하고, t 기반 계수 CI와 PI는 정규 오차 가정을 사용합니다. Pearson r CI는 Fisher z 방식입니다. 높은 r/R²만으로 가정 충족을 확인할 수 없습니다.';
export function methodHelp(r,purpose){const dm=purpose==='deming';return details('방법·적용 조건·출처',table(['항목','값'],r.facts(purpose))+`<p>${dm?demingAssumptions:'독립 검체·같은 항목/단위/정의·정규적인 차이와 일정한 퍼짐을 검토하세요. 평균 차이 CI와 개별 차이 LoA는 다릅니다.'}</p><p><a href="${dm?SOURCES.deming:SOURCES.ba}">${dm?'Deming·jackknife 문서':'Bland–Altman 원 논문'}</a></p>`);}
export function specimenData(rows,model,purpose='qual',full=false,baContext=null){
  const headers=['검체 ID','원행','Reference 결과','Product 결과','확인 사항'];
  if(purpose==='qual')headers.push('정성 비교 방향');
  else headers.push('Reference 검출값','Product 검출값',...(purpose==='ols'?['OLS 잔차','OLS PI 상태']:purpose==='ba'?['Product − Reference','95% LoA 위치','사전 허용 차이 위치']:[]));
  if(full)headers.push('채취일','입력 적격','양성 수치쌍',...(purpose==='deming'?['전체 Deming 예상 Product','Product − Deming 예상값 (Y방향 차이)']:['OLS 예상값','OLS PI 하한','OLS PI 상한','OLS PI 초과량']));
  return {headers,rows:rows.map(p=>{const e=evaluateRow(p,model),b=purpose==='ba'?baObservation(p,baContext):null;const values=[p.id,p.sourceRow,p.raw[2],p.raw[4],p.issues.join('; ')||''];if(purpose==='qual')values.push(p.qual?({TP:'양성 일치',TN:'음성·ND 일치',FP:'Reference 음성·ND → Product 양성',FN:'Reference 양성 → Product 음성·ND'}[p.cls]):'정성 제외');else values.push(p.x,p.y,...(purpose==='ols'?[e.residual,e.state]:purpose==='ba'?[b.difference,b.label,b.tolerance]:[]));if(full){const d=purpose==='deming'?demingSpecimen(p,baContext?.deming):null;values.push(p.date,p.eligible?'포함':!p.id?'ID 누락 제외':'형식 오류 제외',p.pair?'포함':'제외',...(d?[d.fit,d.delta]:[e.fit,e.lo,e.hi,e.excess]));}return values;})};
}
export function rawData(rows){return {headers:['원행',...HEADERS,'입력 적격','형식 오류','확인 사항'],rows:rows.map(p=>[p.sourceRow,...p.raw,p.eligible?'포함':!p.id?'ID 누락 제외':'형식 오류 제외',p.inputErrors.join('; '),p.issues.join('; ')])};}
export function outputSelection(current,checked,options={}){const analyses=options.custom?[...new Set(checked)].filter(k=>k in ANALYSIS_NAMES):[current in ANALYSIS_NAMES?current:'qual'];return {...options,analyses,method:options.method==='deming'?'deming':'ols',overlay:options.overlay===true,purpose:options.purpose||'qual'};}
