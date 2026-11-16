import {numericIntro,olsSummary,methodHelp,demingCaution,pbCaution,pbAssumptions,pbFacts,sideBySide,fmt,esc,ci,table,details} from './result-contract.mjs';
import {PB_SOURCE} from './passing-bablok.mjs';
// Side-by-side table of the three relation lines (estimates are never ranked or judged).
function sideTable(r){return table(['방법','기울기',`${r.level}% CI`,'절편',`${r.level}% CI`,'비고'],sideBySide(r).map(([name,b,bci,a,aci,note])=>[name,fmt(b),ci(bci),fmt(a),ci(aci),note]));}
// Optional R cross-check block. The button is not copied; the result table is.
function rCheckBlock(r){
 const k=r.rCheck;
 // Intro and button are screen-only (data-no-copy); only an actual R result is copied/exported.
 const intro=`<p data-no-copy>도구가 계산한 OLS·Deming·Passing–Bablok 값을 <strong>지금 입력한 자료 그대로</strong> 브라우저 안의 R(mcr 패키지)로 다시 계산해 비교합니다. 처음 한 번 R 환경(약 수십 MB)을 내려받습니다. 입력값은 이 브라우저 밖으로 보내지 않습니다. ${help('rcheck')}</p>`;
 const button='<p data-no-copy><button type="button" id="r-check-run">R로 다시 계산해 대조</button> <span id="r-check-status" role="status" aria-live="polite"></span></p>';
 if(!k)return '<h3 data-no-copy>R로 다시 계산해 대조 (선택)</h3>'+intro+button;
 return '<h3>R로 다시 계산해 대조 (선택)</h3>'+intro+`<p class="finding">${esc(k.summary)}</p><p class="hint">R 환경: webR ${esc(k.environment.webR)} / R ${esc(k.environment.r)} / ${esc(k.environment.packages)} · 상대 차이 1e-9 이하를 일치로 표시합니다(계산 순서에 따른 반올림 차이).</p>`+table(['항목','도구','R (mcr)','상대 차이','비교'],k.rows.map(([name,a,b,d])=>[name,fmt(a),fmt(b),d===null?'—':d.toExponential(1),d===null?'R 값 없음':d<=1e-9?'일치':'차이 있음']))+(k.notes||[]).map(t=>`<p class="hint">${esc(t)}</p>`).join('')+button;
}
import {plot} from './comparison-view.mjs';
import {helpButton as help} from './help-content.mjs';
export function numericScreen(r,chart){
 const n=r.model,d=r.deming,c=r.config,level=r.level;
 const diagnostics=details('특정 검체가 OLS 결과에 미치는 영향',`<p>OLS 영향 진단·한 검체 제외 시 민감도 ${help('influence')}</p><p>전체 OLS: 기울기 ${fmt(n.slope)} / 절편 ${fmt(n.intercept)}. 한 검체를 가상으로 제외한 결과와 비교하세요. 자동 제외나 합격 기준이 아닙니다.</p><p class="hint">전체 OLS 기준 · Cook’s distance 순 상위100행. 전체는 검체별 계산 출력에서 확인합니다.</p>`+table(['검체 ID','원행',"Cook's distance",'Leverage','외적 Studentized residual','제외 시 OLS 기울기','기울기 변화량','제외 시 OLS 절편','절편 변화량'],r.diagnostics().sort((a,b)=>(b.cook??-1)-(a.cook??-1)).slice(0,100).map(p=>[p.id,p.sourceRow,fmt(p.cook),fmt(p.leverage),fmt(p.studentized),fmt(p.withoutSlope),fmt(p.withoutSlope===null?null:p.withoutSlope-n.slope),fmt(p.withoutIntercept),fmt(p.withoutIntercept===null?null:p.withoutIntercept-n.intercept)])));
 const piPlots=`<div class="plots"><div><h3>산점도 · 전체 OLS와 ${r.snapshot.piLevel*100}% PI ${help('pi')}</h3>${chart(r.selected)}</div><div><h3>전체 OLS 기준 잔차 ${help('residual')}</h3>${chart(r.selected,true)}<p>잔차 = Product − OLS 예상값. 직접 차이와 다릅니다.</p></div></div>`;
 let html=numericIntro(r)+`<p class="hint">전체 직선은 고정하고 선택 검체를 표시합니다. ${help('scope')}</p>`+table(['전체 수치쌍의 상관','추정값',`${level}% CI`],[['Pearson r',fmt(n.r),ci(n.rCI)]]);
 if(r.method==='ols'){
  html+=(n.slope===null?'<p>OLS 회귀식 계산 불가.</p>':`<p class="finding">전체 OLS: Product = ${fmt(n.intercept)} + ${fmt(n.slope)} × Reference</p>`)+n.reasons.map(t=>`<p class="warning">${esc(t)}</p>`).join('')+piPlots+olsSummary(r);
  html+=`<p>OLS의 관계·오차 가정을 확인하세요. ${help('residual')}</p>`+details('OLS 계수 CI·R²·잔차 표준오차',`<p>계수·신뢰구간과 잔차 규모를 확인하세요. ${help('slope')}${help('intercept')}${help('r2')}${help('residual')}</p>`+table(['항목','값',`${level}% CI`],[['기울기',fmt(n.slope),ci(n.slopeCI)],['절편',fmt(n.intercept),ci(n.interceptCI)],['R²',fmt(n.r2),''],['잔차 표준오차',fmt(n.se),'']]))+diagnostics+details('세 방법 나란히 보기 (OLS·Deming·Passing–Bablok)',sideTable(r));
 }else if(r.method==='pb'){
  const p=r.pb,cfg=r.config,same=cfg.sameScale===true&&Boolean(cfg.xUnit)&&cfg.xUnit===cfg.yUnit;
  html+='<p><a href="#independent">독립 검체 확인</a> · 설정을 바꾸면 다시 분석하세요.</p>';
  if(!p)html+=`<p class="warning">Passing–Bablok 미설정: ${esc(r.pbReasons.join(' '))}</p>`;
  else{
   if(!same)html+='<p class="warning">같은 측정항목·같은 척도인지 확인되지 않았습니다(BA 설정의 "같은 측정항목·단위·결과 정의"와 두 축 단위). Passing–Bablok은 같은 척도 비교를 전제로 하므로 Ct와 Tt처럼 척도가 다르면 기울기·절편을 "차이"로 읽지 마세요.</p>';
   if(p.negativeValues)html+='<p class="warning">음수 값이 있습니다. 도구는 계산하지만 R mcr은 음수 자료의 Passing–Bablok을 계산하지 않으므로 R 대조를 할 수 없습니다.</p>';
   const lines=p.slope===null?[]:[...(r.equality?[{a:0,b:1,name:'Y=X 기준선',color:'#8794a0',dash:true}]:[]),{a:p.intercept,b:p.slope,name:'전체 Passing–Bablok',color:'#7a4fa0'},...(r.overlay&&n.slope!==null?[{a:n.intercept,b:n.slope,name:'전체 OLS',color:'#668eb0',dash:true}]:[])];
   const xu=cfg.xUnit||'Reference',yu=cfg.yUnit||'Product';
   html+='<div class="numeric-layout"><div class="deming-plot"><h3>산점도 · 전체 Passing–Bablok과 선택 검체</h3>'+plot(r.selected.filter(v=>v.pair),lines,`Reference (${xu})`,`Product (${yu})`,'전체 Passing–Bablok / 선택 검체',`전체 고정 Passing–Bablok n=${p.n} / 선택 n=${r.selectedN} / ${level}% 순위 기반 CI / Y=X 기준선 ${r.equality?'ON':'OFF'}`)+'</div><div class="deming-summary">';
   html+=`<h3>Passing–Bablok 계수 ${help('pb')}</h3>`+table(['Passing–Bablok 계수','추정값',`${level}% CI`,'읽는 법'],[['기울기',fmt(p.slope),ci(p.slopeCI),'1과 비교: 비례 차이 단서'],['절편',fmt(p.intercept),ci(p.interceptCI),'0과 비교: 고정 차이 단서']]);
   if(p.slope!==null)html+=`<p class="finding">전체 Passing–Bablok: Product = ${fmt(p.intercept)} + ${fmt(p.slope)} × Reference</p>`;
   html+='<p>기울기 CI가 1을, 절편 CI가 0을 포함하지 않으면 각각 비례 차이·고정 차이가 있다는 단서입니다. 포함한다고 두 검사법이 같다는 뜻은 아닙니다(검체 수가 적으면 CI가 넓어 쉽게 포함됩니다).</p>';
   const L=p.linearity;
   if(L)html+=`<p>직선성 확인(cusum, 진단용) ${help('pb')}: ${L.statistic===null?esc(L.reason):`통계량 ${fmt(L.statistic)}${L.critical===null?' · 이 신뢰수준의 기준값 없음':` · 기준값 ${fmt(L.critical)} — ${L.exceeds?'기준값보다 커서 직선 관계가 아닐 수 있습니다. 산점도에서 곡선 모양을 확인하세요.':'직선에서 크게 벗어난 모양은 보이지 않습니다.'}`}`} 자동 판정이 아닙니다.</p>`;
   html+=`<p class="hint">${pbCaution}</p>`+(r.equality?'<p>회색 점선 Y=X는 두 값이 같은 위치를 뜻하며 합격선이 아닙니다.</p>':'')+p.reasons.map(t=>`<p class="warning">${esc(t)}</p>`).join('');
   html+=details('Passing–Bablok 상세',table(['기울기 쌍 수 N','순위 이동','직선 위 / 아래 점 수'],[[p.slopeCount,p.shift,L?`${L.above} / ${L.below}`:'—']]))+'</div></div>';
  }
  html+='<h3>세 방법 나란히 보기</h3><p>같은 수치쌍에 세 방법을 적용한 값입니다. 어느 방법이 맞다고 자동으로 고르지 않습니다. 결과가 크게 다르면 이상값·오차 구조·척도를 확인하세요.</p>'+sideTable(r);
  html+=olsSummary(r)+details('별도 OLS 기준 PI·잔차 검토',piPlots+diagnostics)+details('방법·적용 조건·출처',table(['항목','값'],pbFacts(r))+`<p>${pbAssumptions}</p><p><a href="${PB_SOURCE}">Passing & Bablok (1983) 원 논문</a></p>`);
 }else{
  html+='<p><a href="#deming-settings">Deming 적용 조건 설정</a> · 설정을 바꾸면 다시 분석하세요.</p>';
  if(!d)html+=`<p class="warning">Deming 미설정: ${esc(c.demingReasons.join(' '))}</p>`;
  else{
   const lines=d.slope===null?[]:[...(r.equality?[{a:0,b:1,name:'Y=X 기준선',color:'#8794a0',dash:true}]:[]),{a:d.intercept,b:d.slope,name:'전체 Deming',color:'#c0643d'},...(r.overlay&&n.slope!==null?[{a:n.intercept,b:n.slope,name:'전체 OLS',color:'#668eb0',dash:true}]:[])];
   html+='<div class="numeric-layout"><div class="deming-plot"><h3>산점도 · 전체 Deming과 선택 검체</h3>'+plot(r.selected.filter(p=>p.pair),lines,`Reference (${c.xUnit})`,`Product (${c.yUnit})`,'전체 Deming / 선택 검체',`전체 고정 Deming n=${n.n} / 선택 n=${r.selectedN} / λ=${c.lambda} (Product/Reference 오차분산) / ${c.basis} / ${level}% jackknife t CI / Y=X 기준선 ${r.equality?'ON':'OFF'}`)+'</div><div class="deming-summary">';
   html+=`<h3>Deming 계수와 적용 조건 ${help('deming')}</h3><p>λ=${fmt(c.lambda)} · ${esc(c.basis)} ${help('lambda')}<br>Reference: ${esc(c.xUnit)} / Product: ${esc(c.yUnit)}</p>`+table(['Deming 계수','추정값',`${level}% jackknife t CI`],[['기울기',fmt(d.slope),ci(d.slopeCI)],['절편',fmt(d.intercept),ci(d.interceptCI)]]);
   html+=`<p>계수의 의미 ${help('slope')}${help('intercept')}</p>`;
   if(d.slope!==null)html+=`<p class="finding">전체 Deming: Product = ${fmt(d.intercept)} + ${fmt(d.slope)} × Reference</p>`;
   html+=`<p class="hint">${demingCaution}</p>`+(r.equality?'<p>회색 점선 Y=X는 두 값이 같은 위치를 뜻하며 합격선이 아닙니다.</p>':'');
   html+='<p>관계 직선과 CI만으로 동등성을 입증하지 않습니다. 관측 범위 밖으로 외삽하지 마세요.</p>'+d.reasons.map(t=>`<p class="warning">${esc(t)}</p>`).join('');
   html+=details('Deming 상세 통계',`<p>계수 추정의 불확실성입니다. ${help('se')}</p>`+table(['기울기 jackknife SE','절편 jackknife SE'],[[fmt(d.slopeSE),fmt(d.interceptSE)]]))+'</div></div>';
  }
  html+=`<p>일반 Deming의 선형·일정한 오차분산 등 가정을 확인하세요. ${help('deming')}</p>`+olsSummary(r)+details('별도 OLS 기준 PI·잔차 검토',piPlots+diagnostics)+methodHelp(r,'deming')+details('세 방법 나란히 보기 (OLS·Deming·Passing–Bablok)',sideTable(r));
 }
 html+='<p>전체 OLS의 PI 이탈은 탐색 결과이며 새 검체 오류율이나 검사법 동등성을 뜻하지 않습니다.</p>'+rCheckBlock(r)+'<button type="button" data-review="'+r.method+'">수치 검체 확인</button> <button type="button" data-review="ols" data-row-mode="pi-outliers">OLS PI 이탈 검체 확인</button>';
 return html;
}
