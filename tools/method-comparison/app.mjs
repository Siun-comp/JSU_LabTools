import {installHelp} from './help-ui.mjs';
import {helpButton} from './help-content.mjs';
import {plotLegend} from './plot-legend.mjs';
import {baObservation,baObservations} from './ba-observation.mjs';
import {resultContract,specimenData,rawData,outputSelection,ANALYSIS_NAMES} from './result-contract.mjs';
import {numericScreen} from './numeric-screen.mjs';
import {comparisonHTML} from './comparison-view.mjs';
import {analyses,comparisonFacts,olsDiagnostics} from './comparison.mjs';
import {initDateBoundaries,dateLabels,dateMode} from './date-boundaries.mjs';
import {HEADERS,VERSION,parseDelimited,readDelimited,normalize,bounds,labels,subset,summarize,groups,buildModel,prediction,evaluateRow,medianSummary,medianGroups,medianDateGroups,inputAudit,inputAuditEntries,numericCaution} from './core.mjs';
import {formatNumber,formatPercent} from './format.mjs';
import {barChart,detectionBars,agreementBars,medianBars} from './bar-chart.mjs';
import {NOTES} from './notes.mjs';
import {exportReport} from './report-export.mjs';
import {exampleData,EXAMPLE_DESCRIPTION} from './example.mjs';
import {installGraphCopy} from './graph-copy.mjs';
import {readXlsx} from './import.mjs';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=formatNumber,pct=formatPercent,ci=v=>v?.map(fmt).join(' ~ ')||'—',pci=p=>p.ci?p.ci.map(pct).join(' ~ '):'—';
const table=(headers,rows)=>`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const helpUI=installHelp();
let snapshot=null,sourceRecords=null,revision=0,tab='qual',page=0,rowMode='all',selected=[],summary=null;
function dirty(message='입력이 변경되었습니다. 분석을 다시 누르세요.'){revision++;snapshot=null;$('results').hidden=true;$('copy').disabled=true;$('copy-status').textContent='';$('export').disabled=true;$('export-status').textContent='';$('status').textContent=message;}
$('input').addEventListener('input',()=>{sourceRecords=null;$('source').textContent='직접 입력 / 붙여넣기';dirty();});
for(const id of ['ct-cuts','median-cuts','confidence','ci-method','pi-level'])$(id).addEventListener('input',()=>dirty());
for(const id of ['independent','same-scale','comparison-unit','lambda-source','deming-lambda','lambda-basis','ba-lower','ba-upper','reference-unit','product-unit'])$(id).addEventListener('input',()=>dirty());
function syncConditions(){
 const precision=$('lambda-source').value==='precision';$('precision-field').hidden=!precision;$('lambda-basis').disabled=!precision;$('deming-lambda').readOnly=!precision;
 $('lambda-guidance').textContent=precision?'적용 가능한 정밀도 자료의 λ와 근거를 입력하세요. 단위가 바뀌면 λ도 검토하세요.':$('lambda-source').value==='equal'?'탐색적 λ=1 가정입니다. 실제 정밀도 확인이 아니며 단위가 바뀌면 λ도 검토하세요.':'λ=1을 가정할지, 정밀도 자료를 사용할지 선택하세요. 단위가 바뀌면 λ도 검토하세요.';
 const on=$('ba-tolerance').checked;$('tolerance-fields').hidden=!on;for(const id of ['ba-lower','ba-upper'])$(id).disabled=!on;
 const low=$('ba-lower').value,high=$('ba-upper').value,error=on&&(low===''||high===''||!Number.isFinite(Number(low))||!Number.isFinite(Number(high))||Number(low)>=Number(high));
 $('tolerance-error').hidden=!error;$('tolerance-error').textContent=error?'하한·상한을 모두 입력하고 하한이 상한보다 작게 설정하세요.':'';
 for(const id of ['ba-lower','ba-upper']){if(error)$(id).setAttribute('aria-invalid','true');else $(id).removeAttribute('aria-invalid');$(id).setAttribute('aria-describedby','tolerance-error');}
 $('tolerance-unit').textContent=$('comparison-unit').value.trim()||'공통 단위';$('tolerance-guidance').textContent=on?'사전에 정한 허용 범위입니다. 자동 합격 기준이 아닙니다.':'허용 차이와 비교하지 않고 BA 차이 분포만 확인합니다.';
}
for(const id of ['lambda-source','ba-tolerance','ba-lower','ba-upper','comparison-unit'])$(id).addEventListener('input',syncConditions);
$('lambda-source').addEventListener('change',()=>{if($('lambda-source').value==='equal')$('deming-lambda').value='1';syncConditions();});
$('ba-tolerance').addEventListener('change',()=>{syncConditions();dirty();});syncConditions();
const comparisonOptions=()=>({xUnit:$('reference-unit').value,yUnit:$('product-unit').value,independent:$('independent').checked,sameScale:$('same-scale').checked,unit:$('comparison-unit').value,lambdaSource:$('lambda-source').value,lambda:$('deming-lambda').value,basis:$('lambda-basis').value,toleranceRequired:$('ba-tolerance').checked,lower:$('ba-tolerance').checked?$('ba-lower').value:'',upper:$('ba-tolerance').checked?$('ba-upper').value:''});
const dateControl=initDateBoundaries($('date-boundaries'),()=>dirty());
function serialize(records){const field=v=>/[\t\r\n"]/.test(String(v))?'"'+String(v).replaceAll('"','""')+'"':String(v);return records.map(r=>r.cells.map(field).join('\t')).join('\n');}
$('file').addEventListener('change',async()=>{const file=$('file').files[0];if(!file)return;const start=revision;$('status').textContent='파일을 읽고 있습니다.';$('analyze').disabled=true;try{if(file.size>20*1024*1024)throw Error('파일은 20 MB 이하로 입력하세요.');let imported;if(/\.xlsx$/i.test(file.name))imported=await readXlsx(await file.arrayBuffer());else imported={...readDelimited(await file.text()),sheet:'6열 입력'};if(start!==revision){$('status').textContent='파일 읽기 중 편집한 입력을 유지했습니다. 필요하면 파일을 다시 불러오세요.';return;}$('input').value=serialize(imported.records);sourceRecords=imported.records;$('input').scrollTop=0;$('source').textContent=`${file.name} / ${imported.sheet} / ${imported.header.description} / 원래 행 번호 유지`;dirty('파일을 불러왔습니다. 분석을 누르세요.');}catch(e){$('status').textContent=e.message;}finally{$('analyze').disabled=false;$('file').value='';}});
$('clear').onclick=()=>{if($('input').value&&!confirm('입력과 분석 결과를 비울까요?'))return;$('input').value='';sourceRecords=null;$('source').textContent='';dirty('자료를 입력하세요.');};
$('example').onclick=()=>{if($('input').value&&!confirm('현재 입력을 합성 예제로 바꿀까요?'))return;$('input').value=exampleData().map(r=>r.join('\t')).join('\n');sourceRecords=null;$('input').scrollTop=0;$('source').textContent=EXAMPLE_DESCRIPTION;dirty('합성 예제를 입력했습니다. 분석을 누르세요.');};
$('analyze').onclick=()=>{
  try{
    const direct=sourceRecords?null:readDelimited($('input').value);
    const records=sourceRecords||direct.records;
    if(direct&&!$('source').textContent.includes('합성 예제'))$('source').textContent='직접 입력 / 붙여넣기 · '+direct.header.description;
    if(records.length>10000)throw Error('10,000행 이하만 분석합니다.');
    const rows=normalize(records);if(!rows.length)throw Error('분석할 검체를 입력하세요.');
    const confidence=Number($('confidence').value),piLevel=Number($('pi-level').value)/100;
    if(!(confidence>0&&confidence<1))throw Error('CI 수준을 확인하세요.');
    if(!(piLevel>=.001&&piLevel<=.999))throw Error('PI 수준은 0.1–99.9%로 입력하세요.');
    snapshot={comparison:comparisonOptions(),rows,ct:bounds($('ct-cuts').value),dates:dateControl.get(),median:bounds($('median-cuts').value),confidence,piLevel,method:$('ci-method').value,source:$('source').textContent||'직접 입력 / 붙여넣기',model:buildModel(rows,confidence,piLevel)};
    page=0;
    const options=values=>'<option value="all">전체</option>'+values.map((label,i)=>`<option value="${i}">${esc(label)}</option>`).join('');
    $('ct-filter').innerHTML=options(labels(snapshot.ct));
    if(snapshot.dates.length)$('date-filter').innerHTML=options(dateLabels(snapshot.dates));
    else $('date-filter').innerHTML='<option value="all">전체</option>'+[...new Set(rows.filter(r=>r.eligible).map(r=>r.date).filter(Boolean))].sort().map(d=>`<option value="${d}">${d}</option>`).join('');
    $('date-filter').disabled=!rows.some(r=>r.eligible&&r.date);
    $('results').hidden=false;$('copy').disabled=false;$('export').disabled=false;
    $('status').textContent=`분석 완료 · 입력 ${rows.length}행 · ID 누락 ${rows.filter(r=>!r.id).length}개 · 형식 오류 ${rows.filter(r=>r.id&&r.inputErrors.length).length}개 제외 · 분석 적격 검체의 날짜 없음 ${rows.filter(r=>r.eligible&&!r.date).length}개`;
    render();
  }catch(e){dirty(e.message);}
};
for(const id of ['ct-filter','date-filter'])$(id).onchange=()=>{page=0;render();};
const view=()=>({method:$('regression-method').value,overlay:$('ols-overlay').checked});
const currentResult=()=>resultContract(snapshot,selected,view());
let rowPurpose='qual',outputRevision=0;
function showTab(next){tab=next;document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===tab)));for(const id of ['qual','numeric','groups','median','ba','rows'])$(id).hidden=id!==tab;$('numeric-controls').hidden=tab!=='numeric';$('copy-status').textContent='';updateOutputDescription();}
document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>showTab(button.dataset.tab));
for(const id of ['regression-method','ols-overlay'])$(id).onchange=()=>{outputRevision++;$('overlay-control').hidden=$('regression-method').value!=='deming';if(snapshot)render();};
const outputOptions=()=>outputSelection(tab,[...document.querySelectorAll('[data-output]:checked')].map(e=>e.dataset.output),{...view(),custom:$('output-custom').checked,details:$('output-details').checked,specimens:$('output-specimens').checked,raw:$('output-raw').checked,purpose:tab==='numeric'?view().method:tab==='ba'?'ba':rowPurpose,rowMode,listedRows:tab==='rows'?listed():undefined});
function updateOutputDescription(){const o=outputOptions();$('output-description').textContent='Excel: 분석요약 + '+(o.analyses.map(k=>ANALYSIS_NAMES[k]).join(' / ')||'선택 없음')+' · '+(o.details?'상세 통계 포함':'핵심 결과')+(o.specimens?' · 검체별 계산 추가':'')+(o.raw?' · 전체 입력 원문 추가':'');}
for(const el of [...document.querySelectorAll('[data-output]'),...['output-custom','output-details','output-specimens','output-raw'].map($)])el.onchange=()=>{outputRevision++;$('output-analyses').hidden=!$('output-custom').checked;updateOutputDescription();$('copy-status').textContent='';};
$('output-bundle').onclick=()=>{document.querySelectorAll('[data-output]').forEach(e=>e.checked=e.dataset.output!=='ba');outputRevision++;updateOutputDescription();};
$('results').addEventListener('click',e=>{const button=e.target.closest('[data-review]');if(!button)return;rowPurpose=button.dataset.review;rowMode=button.dataset.rowMode||'all';page=0;renderRows();showTab('rows');});
function render(){
  if(!snapshot)return;
  selected=subset(snapshot.rows,{ct:$('ct-filter').value,date:$('date-filter').value},snapshot.ct,snapshot.dates);
  summary=summarize(selected,snapshot.confidence,snapshot.method,snapshot.model);
  const s=summary,allIds=snapshot.rows.filter(r=>!r.id).length;
  $('scope').textContent=`Reference: ${$('ct-filter').selectedOptions[0].textContent} / ${dateMode(snapshot.dates)}: ${$('date-filter').selectedOptions[0].textContent} · CI ${snapshot.confidence*100}% ${snapshot.method==='exact'?'Exact':'Wilson'} · PI ${snapshot.piLevel*100}% · 전체 입력 ID 누락 제외 ${allIds}개 · 형식 오류 제외 ${snapshot.rows.filter(r=>r.id&&r.inputErrors.length).length}개 · 전체 기준 모델 n=${snapshot.model.n}`;
  $('overview').innerHTML=[['표시 원행',s.total],['분석 적격 검체',s.eligible],['유효 정성 쌍',s.valid],['양성 수치 쌍',s.numeric.n],['정성 제외',s.excluded],['수치 제외',s.total-s.numeric.n]].map(([name,n])=>`<div class="card">${name}<strong>${n}</strong></div>`).join('');
  const audit=inputAudit(snapshot.rows);
  $('input-review').innerHTML=`<details class="interpretation"><summary>전체 입력 검증 · ID 누락 ${audit.idExcluded} / 형식 오류 ${audit.formatExcluded} · 결과 미인식 Reference ${audit.referenceUnknown} / Product ${audit.productUnknown}</summary><p class="hint">현재 필터와 관계없는 전체 입력 기준입니다. 제외 행 수는 ID 누락과 ID가 있는 형식 오류로 나눕니다. 항목별 오류는 같은 행이 중복 집계될 수 있으며 ID 누락 행도 포함합니다. 원행과 사유는 검체 목록에서 확인하세요.</p>${table(['전체 입력 검증 항목','행 수'],inputAuditEntries(snapshot.rows))}</details>`+(audit.referenceNonpositive||audit.productNonpositive?`<p class="hint">입력 확인: 0 이하 검출값 Reference ${audit.referenceNonpositive}개 / Product ${audit.productNonpositive}개 (전체 입력). 이 사유만으로 분석에서 제외하지 않습니다.</p>`:'');
  renderQual();renderNumeric();renderGroups();renderMedian();renderRows();
  const comparison=comparisonHTML(snapshot,selected,summary);$('ba').innerHTML=comparison.ba+'<button type="button" data-review="ba">BA 검체 확인</button>';
  updateOutputDescription();
  for(const key of ['groups'])$(key).insertAdjacentHTML('beforeend',notesHTML(key));$('copy-status').textContent='';
  $('results').querySelectorAll('svg').forEach(svg=>{if(!svg.dataset.context)svg.dataset.context=`선택 수치쌍 n=${summary.numeric.n} / ${VERSION}`;});
  installGraphCopy($('results'),()=>$('scope').textContent);
  helpUI.refresh($('results'));
}

function renderQual(){
  const s=summary;const indicator=k=>[k.toUpperCase()+(k==='ppa'?' (양성일치율)':k==='npa'?' (음성일치율)':' (전체일치율)'),s[k].k+' / '+s[k].n,pct(s[k].p),pci(s[k])];
  $('qual').innerHTML='<h2>정성 결과 비교</h2><p>Reference와 Product의 양성/음성·ND 결과가 얼마나 일치하는지 확인합니다. PPA/NPA는 분자·분모와 CI를 함께 읽으세요. 확정 진단 기준이 아니라면 민감도·특이도로 바꾸어 부르지 않습니다.</p>'+table(['Reference','Product 양성','Product 음성·ND','합계'],[['양성',s.TP,s.FN,s.TP+s.FN],['음성·ND',s.FP,s.TN,s.FP+s.TN],['합계',s.TP+s.FP,s.FN+s.TN,s.valid]])+table(['지표','일치 수 / 분모','비율',snapshot.confidence*100+'% CI'],['ppa','npa'].map(indicator))+'<details class="interpretation"><summary>전체일치율 OPA 상세</summary>'+table(['지표','일치 수 / 분모','비율',snapshot.confidence*100+'% CI'],[indicator('opa')])+'</details>'+table(['Reference 양성 n','Product 유효 n','Product Invalid','Product 미입력','평가 가능률'],[[s.refPositive,s.evaluability.k,s.productInvalid,s.productMissing,s.evaluability.k+' / '+s.evaluability.n+' · '+pct(s.evaluability.p)]])+  '<p class="finding">양성 → 음성·ND 불일치 '+s.FN+'개 / 음성·ND → 양성 불일치 '+s.FP+'개. 유효 정성 n='+s.valid+'개입니다.</p><p>평가 가능률은 별도의 분모입니다. 같은 분모의 PPA와 검출률을 중복된 성능처럼 강조하지 않습니다. Invalid·미입력을 음성으로 대입하지 않습니다.</p><p>선택 범위 Invalid '+s.invalid+'개 / 결과 미입력 '+s.missingResult+'개는 정성에서 제외합니다(사유 중복 가능). ID·형식 오류는 전체 입력 검증을 확인하세요.</p><button type="button" data-review="qual" data-row-mode="discordant">정성 불일치 검체 확인</button>';
}
function chart(rows,residual=false){
  const model=snapshot.model,pairs=rows.filter(r=>r.pair).map(r=>({...r,...evaluateRow(r,model)}));
  const points=residual?pairs.filter(p=>p.residual!==null):pairs;
  if(!points.length)return '<p class="hint">표시할 수치 쌍 또는 전체 기준 잔차가 없습니다.</p>';
  const baseline=model.pairs;
  const xs=baseline.map(p=>p.x),ys=baseline.map(p=>residual?evaluateRow(p,model).residual:p.y).filter(Number.isFinite);
  const low=Math.min(...xs),high=Math.max(...xs),curve=Array.from({length:81},(_,i)=>({x:low+(high-low)*i/80,...prediction(model,low+(high-low)*i/80)}));
  if(!residual)for(const p of curve)if(p.lo!==undefined)ys.push(p.lo,p.hi);
  let loX=low,hiX=high,loY=Math.min(...ys),hiY=Math.max(...ys);
  if(!Number.isFinite(hiX-loX)||!Number.isFinite(hiY-loY))return '<p class="hint">수치 범위가 너무 커서 도표를 그릴 수 없습니다.</p>';
  if(loX===hiX){loX-=1;hiX+=1;}if(loY===hiY){loY-=1;hiY+=1;}
  const dx=(hiX-loX)*.06,dy=(hiY-loY)*.10;loX-=dx;hiX+=dx;loY-=dy;hiY+=dy;
  const x=v=>95+(v-loX)/(hiX-loX)*420,y=v=>265-(v-loY)/(hiY-loY)*210;
  const legend=plotLegend([{name:'선택 검체',dot:true,color:'#2b679a'},{name:'OLS PI 이탈 검체',dot:true,color:'#b85b38'},...(residual?[{name:'잔차 0 기준',color:'#a6b3c0',dash:true}]:[{name:'전체 OLS',color:'#c0643d'},{name:'OLS PI',color:'#668eb0',dash:true}])]);
  let svg=`<svg data-legend="${esc(legend.description)}" viewBox="0 0 560 ${legend.height}" role="img" data-context="전체 고정 OLS n=${model.n} / 선택 수치쌍 n=${pairs.length} / OLS PI ${snapshot.piLevel*100}% / ${VERSION}" aria-label="${residual?'전체 OLS 기준 잔차도':'전체 OLS 및 PI와 선택 검체 산점도'}"><path d="M95 45 V265 H520" fill="none" stroke="#70859c"/>`;
  for(let i=0;i<=4;i++){const a=loX+(hiX-loX)*i/4,b=loY+(hiY-loY)*i/4;svg+=`<text x="${x(a)}" y="284" text-anchor="middle">${esc(fmt(a))}</text><text x="86" y="${y(b)+4}" text-anchor="end">${esc(fmt(b))}</text>`;}
  if(residual&&loY<=0&&hiY>=0)svg+=`<path d="M95 ${y(0)} H520" stroke="#a6b3c0" stroke-dasharray="4 4"/>`;
  if(!residual&&model.slope!==null){
    svg+=`<path d="M${x(low)} ${y(model.intercept+model.slope*low)} L${x(high)} ${y(model.intercept+model.slope*high)}" stroke="#c0643d"/>`;
    for(const edge of ['lo','hi']){const valid=curve.filter(p=>Number.isFinite(p[edge]));if(valid.length)svg+=`<path d="${valid.map((p,i)=>`${i?'L':'M'}${x(p.x)} ${y(p[edge])}`).join(' ')}" fill="none" stroke="#668eb0" stroke-dasharray="5 4"/>`;}
  }
  svg+=points.map(p=>`<circle cx="${x(p.x)}" cy="${y(residual?p.residual:p.y)}" r="3.5" fill="${['상한 이탈','하한 이탈'].includes(p.state)?'#b85b38':'#2b679a'}" fill-opacity=".7"><title>${esc(p.id)} / 행 ${p.sourceRow} / ${fmt(p.x)}, ${fmt(residual?p.residual:p.y)} / ${esc(p.state)}</title></circle>`).join('');
  return svg+`<text x="290" y="317" text-anchor="middle">Reference 검출값</text><text x="15" y="165" transform="rotate(-90 15 165)" text-anchor="middle">${residual?'Product 전체 기준 잔차':'Product 검출값'}</text>${legend.markup}</svg>`;
}
function piDescription(pi){return !pi.n?(pi.unavailable?'계산 불가':'대상 없음'):!pi.outliers?'PI 이탈 없음':`상한 ${pi.upper} / 하한 ${pi.lower}`;}
function renderNumeric(){ $('numeric').innerHTML=numericScreen(currentResult(),chart); }
function renderGroups(){
  const view=(kind,title,cuts)=>{
    const gs=kind==='date'&&!selected.some(r=>r.eligible&&r.date)?[]:groups(selected,kind,cuts,snapshot.confidence,snapshot.method,snapshot.model);
    if(!gs.length)return `<h3>${title}</h3><p class="hint">채취일이 없어 날짜별 분석을 할 수 없습니다. 다른 분석은 유지됩니다.</p>`;
    return `<h3>${title}</h3>${kind==='date'?barChart(agreementBars(gs),['PPA','NPA'],title+' PPA / NPA'):barChart(detectionBars(gs),['Product'],title+' 유효 결과 중 검출률')}`+
      (kind==='date'?table(['구간','PPA 양성 / 분모','PPA',`${snapshot.confidence*100}% PPA CI`,'NPA 음성 / 분모','NPA',`${snapshot.confidence*100}% NPA CI`,'유효 정성 n','정성 제외'],gs.map(g=>{const s=g.summary;return [g.label,`${s.ppa.k} / ${s.ppa.n}`,pct(s.ppa.p),pci(s.ppa),`${s.npa.k} / ${s.npa.n}`,pct(s.npa.p),pci(s.npa),s.valid,s.excluded];})):table(['구간','분석 적격 Reference 양성 n','Product 검출 / 유효 n','미검출 n','유효 결과 중 검출률',`${snapshot.confidence*100}% CI`,'Product Invalid','미입력','평가 가능률'],gs.map(g=>{const s=g.summary;return [g.label,s.refPositive,`${s.detection.k} / ${s.detection.n}`,s.FN,pct(s.detection.p),pci(s.detection),s.productInvalid,s.productMissing,`${s.evaluability.k} / ${s.evaluability.n} · ${pct(s.evaluability.p)}`];})))+
      '<details class="group-details"><summary>구간별 정성 일치도·수치 관계·잔차·PI</summary>'+
      table(['구간','유효 정성 n','NPA',`${snapshot.confidence*100}% NPA CI`,'양성 수치쌍 n','그룹 Pearson r','그룹 OLS 기울기','수치쌍 Ref 평균','수치쌍 Product 평균','전체 기준 잔차 평균','PI 계산 가능','이탈 / 계산 가능','이탈률','평균 초과량','PI 상태','수치 해석 참고'],gs.map(g=>{const s=g.summary;return [g.label,s.valid,pct(s.npa.p),pci(s.npa),s.numeric.n,fmt(s.numeric.r),fmt(s.numeric.slope),fmt(s.numeric.xMean),fmt(s.numeric.yMean),fmt(s.pi.residualMean),s.pi.n,`${s.pi.outliers} / ${s.pi.n}`,pct(s.pi.rate),fmt(s.pi.meanExcess),piDescription(s.pi),numericCaution(s.numeric.n)];}))+'</details>';
  };
  $('groups').innerHTML='<h2>구간별 검출률과 경향</h2><p class="hint">막대는 유효 결과 중 검출률입니다. Reference 양성 중 Product 유효 결과의 비율인 평가 가능률도 표에서 함께 확인하세요. ND·Negative는 미검출이며 Invalid·미입력은 검출률 분모에 포함하지 않습니다. 형식 오류는 전체 입력 검증에서 확인합니다. CI는 표에 표시하며 막대그래프에서는 생략합니다.</p>'+
    '<p class="hint">표시 범위 안에서 비교합니다. 같은 Reference 구간을 선택한 뒤 날짜 그래프를 보면 검체 구성 차이를 줄여 살펴볼 수 있습니다. 날짜 차이만으로 원인이나 수집기관을 추정하지 않습니다.</p>'+
    view('ct','Reference 검출값 구간',snapshot.ct)+`<p class="hint">분석 적격 검체 중 Reference 수치 없음 ${summary.xMissing}개는 검출값 구간에서만 제외됩니다.</p>`+
    view('date',dateMode(snapshot.dates),snapshot.dates)+`<p class="hint">분석 적격 검체 중 채취일 없음 ${summary.dateMissing}개는 날짜 구간에서만 제외됩니다.</p>`;
}
const dist=d=>d.n?`${fmt(d.median)} [${fmt(d.q1)}–${fmt(d.q3)}]`:'—';
const notesHTML=key=>'<details class="interpretation"><summary>해석 참고</summary>'+NOTES[key].map(n=>`<p>${esc(n)}</p>`).join('')+'</details>';
function renderMedian(){
  const all=medianSummary(selected),gs=snapshot.median.length?medianGroups(selected,snapshot.median):[],dates=selected.some(r=>r.eligible&&r.date)?medianDateGroups(selected,snapshot.dates):[];
  const grid=(data,title)=>`<h3>${title}</h3><p class="hint">각 막대는 해당 시험법의 검출값 중앙값입니다. Ct/Tt 등 척도가 다르면 두 막대의 높이 차이를 시험법 오차로 해석하지 마세요.</p>`+barChart(medianBars(data),['Reference','Product'],title,false,{paired:true})+table(['구간','전체 Reference n','전체 Reference Median [Q1–Q3]','양성 수치쌍 n','Paired Reference Median [Q1–Q3]','Paired Product Median [Q1–Q3]','참고'],data.map(g=>[g.label,g.all.n,dist(g.all),g.reference.n,dist(g.reference),dist(g.product),g.reference.n===0?'양성 수치쌍 없음':g.reference.n<10?'수치쌍 10개 미만 — 해석 주의':'']));
  $('median').innerHTML='<h2>중앙값 · 사분위수 비교</h2><p class="hint">막대는 동일 검체쌍 Reference·Product의 중앙값입니다. 전체 Reference 분포와 Q1–Q3는 표에서 함께 확인합니다.</p>'+grid([{label:'현재 표시 범위 전체',...all},...gs],'Reference 구간별 중앙값')+(dates.length?grid(dates,snapshot.dates.length?'채취일 구간별 중앙값':'채취일별 중앙값 — 구간 경계 미설정'):'<p class="hint">채취일이 없어 날짜별 중앙값을 분석할 수 없습니다. 다른 분석은 유지됩니다.</p>')+'<p>중앙값·Q1–Q3 읽는 방법 '+helpButton('median')+'</p>'+notesHTML('median');
}
function listed(){
  if(rowMode==='ba-loa-outside'){const r=currentResult();return selected.filter(row=>baObservation(row,r).outside);}
  if(rowMode==='id-excluded')return snapshot.rows.filter(r=>!r.id);
  if(rowMode==='format-excluded')return snapshot.rows.filter(r=>r.inputErrors.length);
  return selected.filter(r=>rowMode==='all'||rowMode==='discordant'&&['FP','FN'].includes(r.cls)||rowMode==='issues'&&r.issues.length||rowMode==='numeric-excluded'&&!r.pair||rowMode==='pi-outliers'&&['상한 이탈','하한 이탈'].includes(evaluateRow(r,snapshot.model).state)||rowMode==='pi-unavailable'&&r.pair&&evaluateRow(r,snapshot.model).state==='계산 불가');
}
function rowData(r){
  const e=evaluateRow(r,snapshot.model);
  return [r.sourceRow,...r.raw.map((v,i)=>i===3&&r.x!==null?fmt(r.x):i===5&&r.y!==null?fmt(r.y):v),r.eligible?'포함':!r.id?'ID 누락 제외':'형식 오류 제외',r.qual?(r.cls==='TP'||r.cls==='TN'?'일치':'불일치'):'정성 제외',r.pair?'포함':'제외',fmt(e.fit),fmt(e.residual),fmt(e.lo),fmt(e.hi),e.state,fmt(e.excess),r.issues.join('; ')||''];
}
function renderRows(){
  const rows=listed(),max=Math.max(0,Math.ceil(rows.length/100)-1);page=Math.min(page,max);
  const pageRows=rows.slice(page*100,page*100+100),baContext=rowPurpose==='ba'?currentResult():null,data=specimenData(pageRows,snapshot.model,rowPurpose,false,baContext),full=specimenData(pageRows,snapshot.model,rowPurpose,true,baContext);
  const showRows=d=>table(d.headers,d.rows.map(r=>r.map(v=>typeof v==='number'?fmt(v):v??'—')));
  $('rows').innerHTML='<h2>목적별 검체 확인</h2><div class="toolbar"><label>검토 목적<select id="row-purpose">'+[['qual','정성'],['ols','OLS PI·잔차'],['deming','Deming 관계'],['ba','BA 직접 차이']].map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select></label><label>표시할 검체<select id="row-mode">'+[['all','현재 표시 범위 전체'],['discordant','정성 불일치'],['issues','누락·확인 사항'],['numeric-excluded','수치쌍 제외'],['ba-loa-outside','BA 95% LoA 밖'],['pi-outliers','OLS PI 이탈'],['pi-unavailable','OLS PI 계산 불가'],['id-excluded','전체 입력 ID 누락 제외'],['format-excluded','전체 입력 형식 오류 제외']].map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select></label></div><p>'+(['id-excluded','format-excluded'].includes(rowMode)?'전체 입력 기준의 제외 목록':'현재 선택 범위 목록')+' · 복사 대상 '+rows.length+'개. 같은 ID도 원행으로 구별합니다.</p>'+showRows(data)+'<details class="interpretation"><summary>현재 페이지 개별 계산 상세</summary>'+showRows(full)+'</details><details class="interpretation"><summary>현재 페이지 입력 원문</summary>'+showRows(rawData(pageRows))+'</details><div class="pager"><button id="previous" '+(page===0?'disabled':'')+'>이전</button><span>'+rows.length+'개 · '+(rows.length?page*100+1:0)+'–'+Math.min(rows.length,(page+1)*100)+' 표시</span><button id="next" '+(page===max?'disabled':'')+'>다음</button></div>';
  if(rowPurpose==='ba'){const b=baObservations(baContext);$('rows').insertAdjacentHTML('afterbegin','<p class="hint">BA LoA는 현재 선택 범위 전체 수치쌍 '+b.n+'개에서 계산한 한계입니다. 밖 검체 목록만으로 다시 계산하지 않습니다. 사전 허용 차이 위치와 별개이며 오류·불합격 판정이 아닙니다.</p>');}
  $('row-purpose').value=rowPurpose;$('row-mode').value=rowMode;
  $('row-purpose').onchange=()=>{rowPurpose=$('row-purpose').value;outputRevision++;page=0;renderRows();updateOutputDescription();};
  $('row-mode').onchange=()=>{rowMode=$('row-mode').value;outputRevision++;page=0;renderRows();$('copy-status').textContent='';};
  $('previous').onclick=()=>{page--;renderRows();};$('next').onclick=()=>{page++;renderRows();};
}
$('copy').onclick=async()=>{
  if(!snapshot)return;
  const current=snapshot,rev=revision,copyTab=tab,scope=$('scope').textContent,ov=outputRevision,r=currentResult(),o=outputOptions();
  const audit=inputAudit(snapshot.rows),meta=[['검사법 비교 분석',VERSION],['입력',snapshot.source],['표시 범위',scope],['분석',ANALYSIS_NAMES[tab]],['전체 입력 ID 누락 제외',audit.idExcluded],['전체 입력 형식 오류 제외',audit.formatExcluded],['현재 분석 적격 n',summary.eligible],['현재 유효 정성 n',summary.valid],['현재 양성 수치쌍 n',summary.numeric.n]];
  if(tab==='numeric')meta.push(['회귀 보기',r.method==='deming'?'Deming':'OLS'],['전체 고정 모델 n',r.model.n],...(r.method==='deming'?r.facts('deming'):[]));if(tab==='ba')meta.push(...r.facts('ba'));
  if(tab==='rows'&&rowPurpose==='ba')meta.push(...r.facts('ba'),['BA 위치 기준 수치쌍 n',r.ba?.n??r.selectedN],['95% LoA 하한',fmt(r.ba?.loa?.[0]??null)],['95% LoA 상한',fmt(r.ba?.loa?.[1]??null)],['위치 해석','현재 선택 범위 전체에서 계산한 LoA. 목록만으로 다시 계산하지 않음. LoA 밖은 오류·불합격 판정 아님']);
  let html=table(['분석 정보','값'],meta);
  if(tab==='rows'){const d=specimenData(listed(),snapshot.model,rowPurpose,o.details,r);html+=table(d.headers,d.rows.map(v=>v.map(x=>typeof x==='number'?fmt(x):x??'—')));}
  else html+=[...$(tab).querySelectorAll('h2,h3,p,summary,table')].filter(el=>!el.closest('svg')&&(o.details||!el.closest('details'))).map(el=>el.tagName==='SUMMARY'?'<h3>'+esc(el.textContent)+'</h3>':el.outerHTML).join('');
  if(o.specimens&&tab!=='rows'){const d=specimenData(selected,snapshot.model,tab==='ba'?'ba':tab==='numeric'?r.method:'qual',true,r);html+='<h3>현재 선택 검체별 계산</h3>'+table(d.headers,d.rows.map(v=>v.map(x=>typeof x==='number'?fmt(x):x??'—')));}
  if(o.raw){const d=rawData(snapshot.rows);html+='<h3>전체 입력 원문 (필터와 무관)</h3>'+table(d.headers,d.rows);}
  const div=document.createElement('div');div.innerHTML=html;div.querySelectorAll('[data-no-copy],.help-tooltip,.assist-dialog').forEach(el=>el.remove());
  div.querySelectorAll('td').forEach(cell=>{const v=cell.textContent;if(/^[=+@]/.test(v)||/^-(?!\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$)/.test(v)){cell.textContent="'"+v;cell.style.setProperty('mso-number-format','"@"');}});html=div.innerHTML;
  const text=[...div.querySelectorAll('tr,p,h2,h3')].map(el=>el.tagName==='TR'?[...el.children].map(c=>c.textContent.replace(/[\t\r\n]+/g,' ')).join('\t'):el.textContent).join('\n');
  html='<div style="font-family:Malgun Gothic;font-size:9pt">'+html.replaceAll('<table>','<table style="border-collapse:collapse;font-family:Malgun Gothic;font-size:9pt">')+'</div>';
  try{if(globalThis.ClipboardItem)await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([text],{type:'text/plain'}),'text/html':new Blob([html],{type:'text/html'})})]);else await navigator.clipboard.writeText(text);if(snapshot===current&&revision===rev&&tab===copyTab&&$('scope').textContent===scope&&outputRevision===ov)$('copy-status').textContent='복사했습니다.';}
  catch{$('copy-status').textContent='클립보드 접근을 허용한 뒤 다시 복사하세요.';}
};
$('export').onclick=async()=>{
  if(!snapshot)return;
  const current=snapshot,rev=revision,scope=$('scope').textContent,rows=selected.slice(),o=outputOptions(),ov=outputRevision,exportTab=tab;
  const titleSize=Number($('report-title-size').value),emphasisSize=Number($('report-emphasis-size').value);
  if(!(titleSize>=9&&titleSize<=24&&emphasisSize>=9&&emphasisSize<=18)){$('export-status').textContent='제목은 9–24pt, 강조는 9–18pt로 입력하세요.';return;}
  $('export').disabled=true;$('export-status').textContent='그래프를 포함한 리포트를 만들고 있습니다.';
  try{
    const blob=await exportReport(current,rows,scope,{titleSize,emphasisSize,...o});
    if(snapshot!==current||revision!==rev||$('scope').textContent!==scope||outputRevision!==ov||tab!==exportTab){$('export-status').textContent='분석 내용이 변경되어 저장하지 않았습니다. 현재 결과로 다시 저장하세요.';return;}
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='검사법_비교_리포트_'+new Date().toISOString().slice(0,10)+'.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);$('export-status').textContent='Excel 다운로드를 요청했습니다. 브라우저 다운로드 목록을 확인하세요.';
  }catch(e){$('export-status').textContent='리포트 저장 실패: '+e.message;}finally{$('export').disabled=!snapshot;}
};
