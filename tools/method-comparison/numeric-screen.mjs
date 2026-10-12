import {numericIntro,olsSummary,methodHelp,fmt,esc,ci,table,details} from './result-contract.mjs';
import {plot} from './comparison-view.mjs';
import {helpButton as help} from './help-content.mjs';
export function numericScreen(r,chart){
 const n=r.model,d=r.deming,c=r.config,level=r.level;
 const diagnostics=details('특정 검체가 OLS 결과에 미치는 영향',`<p>OLS 영향 진단·한 검체 제외 시 민감도 ${help('influence')}</p><p>전체 OLS: 기울기 ${fmt(n.slope)} / 절편 ${fmt(n.intercept)}. 한 검체를 가상으로 제외한 결과와 비교하세요. 자동 제외나 합격 기준이 아닙니다.</p><p class="hint">전체 OLS 기준 · Cook’s distance 순 상위100행. 전체는 검체별 계산 출력에서 확인합니다.</p>`+table(['검체 ID','원행',"Cook's distance",'Leverage','외적 Studentized residual','제외 시 OLS 기울기','기울기 변화량','제외 시 OLS 절편','절편 변화량'],r.diagnostics().sort((a,b)=>(b.cook??-1)-(a.cook??-1)).slice(0,100).map(p=>[p.id,p.sourceRow,fmt(p.cook),fmt(p.leverage),fmt(p.studentized),fmt(p.withoutSlope),fmt(p.withoutSlope===null?null:p.withoutSlope-n.slope),fmt(p.withoutIntercept),fmt(p.withoutIntercept===null?null:p.withoutIntercept-n.intercept)])));
 const piPlots=`<div class="plots"><div><h3>산점도 · 전체 OLS와 ${r.snapshot.piLevel*100}% PI ${help('pi')}</h3>${chart(r.selected)}</div><div><h3>전체 OLS 기준 잔차 ${help('residual')}</h3>${chart(r.selected,true)}<p>잔차 = Product − OLS 예상값. 직접 차이와 다릅니다.</p></div></div>`;
 let html=numericIntro(r)+`<p class="hint">전체 직선은 고정하고 선택 검체를 표시합니다. ${help('scope')}</p>`+table(['전체 수치쌍의 상관','추정값',`${level}% CI`],[['Pearson r',fmt(n.r),ci(n.rCI)]]);
 if(r.method==='ols'){
  html+=(n.slope===null?'<p>OLS 회귀식 계산 불가.</p>':`<p class="finding">전체 OLS: Product = ${fmt(n.intercept)} + ${fmt(n.slope)} × Reference</p>`)+n.reasons.map(t=>`<p class="warning">${esc(t)}</p>`).join('')+piPlots+olsSummary(r);
  html+=`<p>OLS의 관계·오차 가정을 확인하세요. ${help('residual')}</p>`+details('OLS 계수 CI·R²·잔차 표준오차',`<p>계수·신뢰구간과 잔차 규모를 확인하세요. ${help('slope')}${help('intercept')}${help('r2')}${help('residual')}</p>`+table(['항목','값',`${level}% CI`],[['기울기',fmt(n.slope),ci(n.slopeCI)],['절편',fmt(n.intercept),ci(n.interceptCI)],['R²',fmt(n.r2),''],['잔차 표준오차',fmt(n.se),'']]))+diagnostics;
 }else{
  html+='<p><a href="#deming-settings">Deming 적용 조건 설정</a> · 설정을 바꾸면 다시 분석하세요.</p>';
  if(!d)html+=`<p class="warning">Deming 미설정: ${esc(c.demingReasons.join(' '))}</p>`;
  else{
   const lines=d.slope===null?[]:[{a:d.intercept,b:d.slope,name:'전체 Deming',color:'#c0643d'},...(r.overlay&&n.slope!==null?[{a:n.intercept,b:n.slope,name:'전체 OLS',color:'#668eb0',dash:true}]:[])];
   html+='<div class="numeric-layout"><div class="deming-plot"><h3>산점도 · 전체 Deming과 선택 검체</h3>'+plot(r.selected.filter(p=>p.pair),lines,`Reference (${c.xUnit})`,`Product (${c.yUnit})`,'전체 Deming / 선택 검체',`전체 고정 Deming n=${n.n} / 선택 n=${r.selectedN} / λ=${c.lambda} (Product/Reference 오차분산) / ${c.basis} / ${level}% jackknife t CI`)+'</div><div class="deming-summary">';
   html+=`<h3>Deming 계수와 적용 조건 ${help('deming')}</h3><p>λ=${fmt(c.lambda)} · ${esc(c.basis)} ${help('lambda')}<br>Reference: ${esc(c.xUnit)} / Product: ${esc(c.yUnit)}</p>`+table(['Deming 계수','추정값',`${level}% jackknife t CI`],[['기울기',fmt(d.slope),ci(d.slopeCI)],['절편',fmt(d.intercept),ci(d.interceptCI)]]);
   html+=`<p>계수의 의미 ${help('slope')}${help('intercept')}</p>`;
   if(d.slope!==null)html+=`<p class="finding">전체 Deming: Product = ${fmt(d.intercept)} + ${fmt(d.slope)} × Reference</p>`;
   html+='<p>관계 직선과 CI만으로 동등성을 입증하지 않습니다. 관측 범위 밖으로 외삽하지 마세요.</p>'+d.reasons.map(t=>`<p class="warning">${esc(t)}</p>`).join('');
   html+=details('Deming 상세 통계',`<p>계수 추정의 불확실성입니다. ${help('se')}</p>`+table(['기울기 jackknife SE','절편 jackknife SE'],[[fmt(d.slopeSE),fmt(d.interceptSE)]]))+'</div></div>';
  }
  html+=`<p>일반 Deming의 선형·일정한 오차분산 등 가정을 확인하세요. ${help('deming')}</p>`+olsSummary(r)+details('별도 OLS 기준 PI·잔차 검토',piPlots+diagnostics)+methodHelp(r,'deming');
 }
 html+='<p>전체 OLS의 PI 이탈은 탐색 결과이며 새 검체 오류율이나 검사법 동등성을 뜻하지 않습니다.</p><button type="button" data-review="'+r.method+'">수치 검체 확인</button> <button type="button" data-review="ols" data-row-mode="pi-outliers">OLS PI 이탈 검체 확인</button>';
 return html;
}
