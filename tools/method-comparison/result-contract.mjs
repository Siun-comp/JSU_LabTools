import {analyses,comparisonFacts,olsDiagnostics,METHODS,SOURCES} from './comparison.mjs';
import {demingSpecimen} from './practical-data.mjs';
import {baObservation} from './ba-observation.mjs';
import {summarize,evaluateRow,HEADERS,numericCaution} from './core.mjs';
import {formatNumber as fmt,formatPercent as pct,numberFormat} from './format.mjs';
import {passingBablok,PB_METHOD,PB_SOURCE} from './passing-bablok.mjs';
export {fmt,pct};
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const ci=v=>v?.map(fmt).join(' ~ ')||'—';
export const table=(headers,rows)=>`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
export const details=(title,body)=>`<details class="interpretation"><summary>${esc(title)}</summary>${body}</details>`;
export const num=value=>({value,format:numberFormat(value)});
export const REGRESSION_NAMES={ols:'OLS',deming:'Deming',pb:'Passing–Bablok'};
export const pbCaution='Passing–Bablok은 두 값이 같은 측정항목·같은 척도라는 전제가 강합니다. 기울기 −1 처리 때문에 한쪽 척도만 바꾸면 결과가 달라질 수 있습니다. 순위 기반 방법이라 이상값 몇 개에는 덜 흔들리지만, 검체 수가 적으면 CI가 넓습니다.';
export const pbAssumptions='Passing–Bablok은 독립 검체·두 값 사이의 직선 관계·양의 관계(Kendall τ ≥ 0)를 가정하며 오차 분포 모양을 정하지 않습니다. CI는 원 논문의 순위 기반 근사(R mcr analytical과 같은 순위 규칙)이고, cusum 직선성 확인은 진단 정보이며 자동 판정이 아닙니다.';
export function pbFacts(r){const c=r.config,same=c.sameScale===true&&Boolean(c.xUnit)&&c.xUnit===c.yUnit;return [['Passing–Bablok 방법',PB_METHOD],['독립 검체 확인',c.independent?'확인':'미확인'],['같은 척도 확인',same?'확인 (같은 측정항목·단위·결과 정의, 두 축 단위 '+c.xUnit+')':'미확인 — 결과 해석 주의'],['방법 출처',PB_SOURCE]];}
// Row markers for Excel key–value tables: a section band, a sub-table header, or a small gap.
export const section=title=>Object.assign([title],{section:true});
export const tableHeader=cells=>Object.assign(cells,{tableHeader:true});
export const spacer=()=>Object.assign([],{spacer:true});
export const ANALYSIS_NAMES={qual:'정성 비교',numeric:'수치 관계·PI',groups:'구간별 분석',median:'중앙값 분석',ba:'BA·직접 차이',rows:'검체 목록'};
export const equalityAvailable=c=>c.sameScale===true&&Boolean(c.xUnit)&&c.xUnit===c.yUnit;
export const baPrecisionNote=b=>b.n===2?'수치쌍이 2개뿐입니다. LoA를 계산할 수 있어도 안정된 일치한계로 해석하기 어렵습니다. LoA 끝점의 CI와 검체 수를 함께 확인하세요.':b.loa?'LoA는 표본에서 추정한 한계입니다. 검체 수와 LoA 끝점의 CI로 한계 추정의 불확실성을 함께 확인하세요.':'';
export const demingCaution='적용 범위에서 각 축의 측정오차 분산이 일정하다고 가정합니다. 값이 커질수록 퍼짐이 넓어지면 이 가정을 재검토하세요. λ 추정의 불확실성은 계수 CI에 포함하지 않습니다.';
const pbCache=new WeakMap();
function pbFor(snapshot){if(!pbCache.has(snapshot))pbCache.set(snapshot,passingBablok(snapshot.rows.filter(p=>p.eligible),snapshot.confidence));return pbCache.get(snapshot);}
export function resultContract(snapshot,selected,view={}){
  const method=['deming','pb'].includes(view.method)?view.method:'ols',r=analyses(snapshot,selected),s=summarize(selected,snapshot.confidence,snapshot.method,snapshot.model);
  const range=rows=>{const p=rows.filter(v=>v.pair);return p.length?`Reference ${fmt(Math.min(...p.map(v=>v.x)))} ~ ${fmt(Math.max(...p.map(v=>v.x)))} / Product ${fmt(Math.min(...p.map(v=>v.y)))} ~ ${fmt(Math.max(...p.map(v=>v.y)))}`:'수치쌍 없음';};
  // Passing–Bablok uses the same fixed whole-input pairs as OLS/Deming; computed only when shown (O(n²)).
  const pbReasons=r.config.independent?[]:['독립 검체 1개당 1쌍인지 확인하세요. 반복측정 행은 Passing–Bablok에 넣지 않습니다.'];
  const wantPB=method==='pb'||view.withPB===true||view.purpose==='pb';
  const pb=wantPB&&!pbReasons.length?pbFor(snapshot):null;
  const line=method!=='ols';
  return {snapshot,selected,summary:s,...r,method,pb,pbReasons,rCheck:view.rCheck||null,overlay:line&&view.overlay===true,equality:line&&view.equality===true&&equalityAvailable(r.config),model:snapshot.model,level:snapshot.confidence*100,modelRange:range(snapshot.rows),selectedRange:range(selected),diagnostics:()=>olsDiagnostics(snapshot.model),facts:purpose=>comparisonFacts(r).filter(([k])=>purpose==='ba'?!k.startsWith('Deming'):purpose==='deming'?k.startsWith('Deming')||k==='독립 검체 확인':false)};
}
export function numericRows(r,detail=false){
  const m=r.method==='deming'?r.deming:r.method==='pb'?r.pb:r.model;
  const out=[section('분석 대상'),['회귀 방법',r.method==='deming'?'일반 Deming':r.method==='pb'?'Passing–Bablok':'OLS'],['모델 대상','전체 적격 양성 수치쌍 고정 — 필터 재적합 없음'],['전체 모델 n',r.model.n],['현재 선택 수치쌍 n',r.selectedN],['전체 관측 범위',r.modelRange],['현재 선택 관측 범위',r.selectedRange],section('상관'),['Pearson r',num(r.model.r)],['Pearson r CI 하한',num(r.model.rCI?.[0]??null)],['Pearson r CI 상한',num(r.model.rCI?.[1]??null)],section('관계 직선'),['회귀식',m?.slope==null?'계산 불가':`Product = ${fmt(m.intercept)} + ${fmt(m.slope)} × Reference`]];
  if(r.method==='deming')out.push(section('Deming 조건과 계수'),...r.facts('deming'),['Reference 단위/척도',r.config.xUnit||'미입력'],['Product 단위/척도',r.config.yUnit||'미입력'],['기울기',num(m?.slope??null)],['기울기 CI 하한',num(m?.slopeCI?.[0]??null)],['기울기 CI 상한',num(m?.slopeCI?.[1]??null)],['절편',num(m?.intercept??null)],['절편 CI 하한',num(m?.interceptCI?.[0]??null)],['절편 CI 상한',num(m?.interceptCI?.[1]??null)],section('표시 설정'),['OLS 회귀선 중첩',r.overlay?'ON':'OFF'],['Y=X 기준선',r.equality?'ON — 동일 항목·단위·결과 정의 확인':'OFF']);
  if(r.method==='pb')out.push(section('Passing–Bablok 조건과 계수'),...pbFacts(r),...(r.pbReasons.length?[['Passing–Bablok 미설정',r.pbReasons.join(' ')]]:[]),...(m?.reasons?.length?[['계산 제한',m.reasons.join(' ')]]:[]),['기울기',num(m?.slope??null)],['기울기 CI 하한',num(m?.slopeCI?.[0]??null)],['기울기 CI 상한',num(m?.slopeCI?.[1]??null)],['절편',num(m?.intercept??null)],['절편 CI 하한',num(m?.interceptCI?.[0]??null)],['절편 CI 상한',num(m?.interceptCI?.[1]??null)],['직선성 cusum 통계량',m?.linearity?.statistic==null?(m?.linearity?.reason||'계산 불가'):num(m.linearity.statistic)],['cusum 기준값 (진단용)',m?.linearity?.critical==null?'해당 신뢰수준의 기준값 없음':num(m.linearity.critical)],section('세 방법 나란히'),...sideBySide(r).map(([name,b,bci,ia,aci,note])=>['세 방법 나란히: '+name,`기울기 ${fmt(b)} (${ci(bci)}) · 절편 ${fmt(ia)} (${ci(aci)}) · ${note}`]),section('표시 설정'),['OLS 회귀선 중첩',r.overlay?'ON':'OFF'],['Y=X 기준선',r.equality?'ON — 동일 항목·단위·결과 정의 확인':'OFF']);
  out.push(section('OLS PI 검토'),['별도 OLS PI 기준',`전체 고정 OLS / PI ${r.snapshot.piLevel*100}%`],['OLS PI 이탈 / 계산 가능',`${r.summary.pi.outliers} / ${r.summary.pi.n}`],['OLS PI 계산 불가',r.summary.pi.unavailable],['해석','상관·직선 관계는 직접 일치나 동등성 입증이 아님. PI 이탈은 자동 제외 사유 아님']);
  if(r.rCheck)out.push(section('R로 다시 계산해 대조'),...rCheckRows(r));
  if(detail)out.push(section('상세 통계'),...(r.method==='pb'?[['기울기 쌍 수 N',m?.slopeCount??'—'],['순위 이동 (2×기울기<−1 수 + 기울기=−1 수)',m?.shift??'—'],['직선 위 / 아래 점 수 (cusum)',m?.linearity?`${m.linearity.above} / ${m.linearity.below}`:'—']]:r.method==='deming'?[['기울기 jackknife SE',num(m?.slopeSE??null)],['절편 jackknife SE',num(m?.interceptSE??null)]]:[['OLS 기울기',num(m.slope)],['OLS 기울기 CI 하한',num(m.slopeCI?.[0]??null)],['OLS 기울기 CI 상한',num(m.slopeCI?.[1]??null)],['OLS 절편',num(m.intercept)],['OLS 절편 CI 하한',num(m.interceptCI?.[0]??null)],['OLS 절편 CI 상한',num(m.interceptCI?.[1]??null)],['R²',num(m.r2)],['잔차 표준오차',num(m.se)]]));
  return out;
}
// "세 방법 나란히 보기" rows: label, slope, slope CI, intercept, intercept CI, note.
export function sideBySide(r){
  const row=(name,m,note)=>[name,m?.slope??null,m?.slopeCI??null,m?.intercept??null,m?.interceptCI??null,note];
  return [row('OLS',r.model,r.model.slope===null?r.model.reasons.join(' '):'Product 방향 잔차 최소화 · t CI'),
   row('Deming',r.deming,!r.deming?'미설정: '+r.config.demingReasons.join(' '):r.deming.slope===null?r.deming.reasons.join(' '):'λ='+fmt(r.config.lambda)+' · jackknife t(n−1) CI'),
   row('Passing–Bablok',r.pb,!r.pb?(r.pbReasons.join(' ')||'Passing–Bablok 보기에서 계산'):r.pb.slope===null?r.pb.reasons.join(' '):'순위 기반 · 이상값에 덜 흔들림')];
}
// R cross-check rows (only after the user ran it for this exact result).
export function rCheckRows(r){
  const k=r.rCheck;if(!k)return [];
  return [['R 대조 환경',`webR ${k.environment.webR} / R ${k.environment.r} / ${k.environment.packages}`],['R 대조 결과',k.summary],...k.rows.map(v=>['R 대조: '+v[0],v[3]===null?'R 값 없음':`도구 ${fmt(v[1])} · R ${fmt(v[2])} · 상대 차이 ${v[3].toExponential(1)}`])];
}
export function numericIntro(r){const duplicates=r.snapshot.rows.filter(p=>p.issues.some(v=>v.includes('중복'))).length;return `<h2>수치 관계 · ${r.method==='deming'?'Deming':r.method==='pb'?'Passing–Bablok':'OLS·PI'}</h2><p>두 수치의 직선 관계를 확인합니다. Reference는 X, Product는 Y입니다. 높은 상관은 같은 값이나 대체 가능성을 뜻하지 않습니다.</p><p class="hint">각 행은 독립 검체의 한 쌍이어야 합니다. 같은 검체의 반복 행을 독립 검체 수로 세지 마세요.</p><p>전체 모델 n=${r.model.n} · 현재 선택 수치쌍 n=${r.selectedN}<br>전체: ${esc(r.modelRange)}<br>선택: ${esc(r.selectedRange)}</p>`+(duplicates?`<p class="warning">전체 입력의 중복 ID 표시 ${duplicates}행은 합치지 않고 보존합니다. 같은 검체의 반복측정이면 독립 검체 모형을 사용하지 마세요. ID만으로 반복 설계를 확인할 수 없습니다.</p>`:'')+(r.selectedN===0?'<p class="warning">현재 선택 범위에 수치쌍이 없습니다. 전체 모델이 있어도 선택 검체 결과는 없습니다.</p>':'')+[numericCaution(r.model.n),r.selectedN!==r.model.n?numericCaution(r.selectedN):''].filter(Boolean).map(t=>`<p class="warning">${esc(t)}</p>`).join('');}
export function olsSummary(r){const p=r.summary.pi;return `<p class="finding">별도 OLS 기준 PI 검토: 이탈 ${p.outliers} / 계산 가능 ${p.n}개 · 계산 불가 ${p.unavailable}개 · 전체 OLS ${r.snapshot.piLevel*100}% PI. 직선을 만든 자료에서 확인한 탐색 결과이며 새 검체 오류율이 아닙니다. 이탈은 자동 제외 사유가 아닙니다.</p>`;}
export const demingAssumptions='일반 Deming은 독립 검체·선형 관계·평균 0의 측정오차·두 축 오차의 독립성·각 축의 일정한 측정오차 분산과 지정 λ를 가정합니다. λ 자체의 불확실성은 계수 CI에 포함하지 않습니다. 계수 CI는 OLS PI가 아닙니다.';
export const olsAssumptions='OLS는 관측 Reference를 설명변수로 사용합니다. 독립성·선형 관계·일정한 잔차 분산을 검토하고, t 기반 계수 CI와 PI는 정규 오차 가정을 사용합니다. Pearson r CI는 Fisher z 방식입니다. 높은 r/R²만으로 가정 충족을 확인할 수 없습니다.';
export function methodHelp(r,purpose){const dm=purpose==='deming';return details('방법·적용 조건·출처',table(['항목','값'],r.facts(purpose))+`<p>${dm?demingAssumptions:'독립 검체·같은 항목/단위/정의·정규적인 차이와 일정한 퍼짐을 검토하세요. 평균 차이 CI와 개별 차이 LoA는 다릅니다.'}</p><p><a href="${dm?SOURCES.deming:SOURCES.ba}">${dm?'Deming·jackknife 문서':'Bland–Altman 원 논문'}</a></p>`);}
export function specimenData(rows,model,purpose='qual',full=false,baContext=null){
  const headers=['검체 ID','원행','Reference 결과','Product 결과','확인 사항'];
  if(purpose==='qual')headers.push('정성 비교 방향');
  else headers.push('Reference 검출값','Product 검출값',...(purpose==='ols'?['OLS 잔차','OLS PI 상태']:purpose==='ba'?['Product − Reference','95% LoA 위치','사전 허용 차이 위치']:[]));
  if(full)headers.push('채취일','입력 적격','양성 수치쌍',...(purpose==='deming'?['전체 Deming 예상 Product','Product − Deming 예상값 (Y방향 차이)']:purpose==='pb'?['전체 Passing–Bablok 예상 Product','Product − PB 예상값 (Y방향 차이)']:['OLS 예상값','OLS PI 하한','OLS PI 상한','OLS PI 초과량']));
  return {headers,rows:rows.map(p=>{const e=evaluateRow(p,model),b=purpose==='ba'?baObservation(p,baContext):null;const values=[p.id,p.sourceRow,p.raw[2],p.raw[4],p.issues.join('; ')||''];if(purpose==='qual')values.push(p.qual?({TP:'양성 일치',TN:'음성·ND 일치',FP:'Reference 음성·ND → Product 양성',FN:'Reference 양성 → Product 음성·ND'}[p.cls]):'정성 제외');else values.push(p.x,p.y,...(purpose==='ols'?[e.residual,e.state]:purpose==='ba'?[b.difference,b.label,b.tolerance]:[]));if(full){const d=purpose==='deming'?demingSpecimen(p,baContext?.deming):purpose==='pb'?demingSpecimen(p,baContext?.pb):null;values.push(p.date,p.eligible?'포함':!p.id?'ID 누락 제외':'형식 오류 제외',p.pair?'포함':'제외',...(d?[d.fit,d.delta]:[e.fit,e.lo,e.hi,e.excess]));}return values;})};
}
export function rawData(rows){return {headers:['원행',...HEADERS,'입력 적격','형식 오류','확인 사항'],rows:rows.map(p=>[p.sourceRow,...p.raw,p.eligible?'포함':!p.id?'ID 누락 제외':'형식 오류 제외',p.inputErrors.join('; '),p.issues.join('; ')])};}
export function outputSelection(current,checked,options={}){const analyses=options.custom?[...new Set(checked)].filter(k=>k in ANALYSIS_NAMES):[current in ANALYSIS_NAMES?current:'qual'];return {...options,analyses,method:['deming','pb'].includes(options.method)?options.method:'ols',overlay:options.overlay===true,purpose:options.purpose||'qual'};}
