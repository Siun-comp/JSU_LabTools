import {initDateBoundaries,dateLabels,dateMode} from './date-boundaries.mjs';
import {HEADERS,VERSION,parseDelimited,readDelimited,normalize,bounds,labels,subset,summarize,groups,buildModel,prediction,evaluateRow,medianSummary,medianGroups,medianDateGroups} from './core.mjs';
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
let snapshot=null,sourceRecords=null,revision=0,tab='qual',page=0,rowMode='all',selected=[],summary=null;
function dirty(message='입력이 변경되었습니다. 분석을 다시 누르세요.'){revision++;snapshot=null;$('results').hidden=true;$('copy').disabled=true;$('copy-status').textContent='';$('export').disabled=true;$('export-status').textContent='';$('status').textContent=message;}
$('input').addEventListener('input',()=>{sourceRecords=null;$('source').textContent='직접 입력 / 붙여넣기';dirty();});
for(const id of ['ct-cuts','median-cuts','confidence','ci-method','pi-level'])$(id).addEventListener('input',()=>dirty());
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
    snapshot={rows,ct:bounds($('ct-cuts').value),dates:dateControl.get(),median:bounds($('median-cuts').value),confidence,piLevel,method:$('ci-method').value,source:$('source').textContent||'직접 입력 / 붙여넣기',model:buildModel(rows,confidence,piLevel)};
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
document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{tab=button.dataset.tab;document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));for(const id of ['qual','numeric','groups','median','rows'])$(id).hidden=id!==tab;$('copy-status').textContent='';});
function render(){
  if(!snapshot)return;
  selected=subset(snapshot.rows,{ct:$('ct-filter').value,date:$('date-filter').value},snapshot.ct,snapshot.dates);
  summary=summarize(selected,snapshot.confidence,snapshot.method,snapshot.model);
  const s=summary,allIds=snapshot.rows.filter(r=>!r.id).length;
  $('scope').textContent=`Reference: ${$('ct-filter').selectedOptions[0].textContent} / ${dateMode(snapshot.dates)}: ${$('date-filter').selectedOptions[0].textContent} · CI ${snapshot.confidence*100}% ${snapshot.method==='exact'?'Exact':'Wilson'} · PI ${snapshot.piLevel*100}% · 전체 입력 ID 누락 제외 ${allIds}개 · 형식 오류 제외 ${snapshot.rows.filter(r=>r.id&&r.inputErrors.length).length}개 · 전체 기준 모델 n=${snapshot.model.n}`;
  $('overview').innerHTML=[['표시 원행',s.total],['분석 적격 검체',s.eligible],['유효 정성 쌍',s.valid],['양성 수치 쌍',s.numeric.n],['정성 제외',s.excluded],['수치 제외',s.total-s.numeric.n]].map(([name,n])=>`<div class="card">${name}<strong>${n}</strong></div>`).join('');
  renderQual();renderNumeric();renderGroups();renderMedian();renderRows();
  for(const key of ['qual','numeric','groups'])$(key).insertAdjacentHTML('beforeend',notesHTML(key));$('copy-status').textContent='';
  installGraphCopy($('results'),()=>$('scope').textContent);
}
function renderQual(){
  const s=summary;
  $('qual').innerHTML='<h2>정성 결과 비교</h2>'+table(['Reference','Product 양성','Product 음성·ND','합계'],[['양성',s.TP,s.FN,s.TP+s.FN],['음성·ND',s.FP,s.TN,s.FP+s.TN],['합계',s.TP+s.FP,s.FN+s.TN,s.valid]])+
    '<h3>일치도</h3>'+table(['지표','일치 수 / 분모','비율',`${snapshot.confidence*100}% CI`],[['PPA (양성일치율)',`${s.ppa.k} / ${s.ppa.n}`,pct(s.ppa.p),pci(s.ppa)],['NPA (음성일치율)',`${s.npa.k} / ${s.npa.n}`,pct(s.npa.p),pci(s.npa)],['OPA (전체일치율)',`${s.opa.k} / ${s.opa.n}`,pct(s.opa.p),pci(s.opa)]])+
    `<p class="hint">ID 누락 제외 ${s.idExcluded}개. ID가 있는 검체의 Invalid ${s.invalid}개 / 결과 미입력 ${s.missingResult}개 / 미인식 ${s.unknownResult}개는 정성 비교에서 제외합니다. 사유는 중복될 수 있습니다. 날짜·수치 누락은 정성 비교를 막지 않습니다.</p>`;
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
  let svg=`<svg viewBox="0 0 560 330" role="img" aria-label="${residual?'전체 OLS 기준 잔차도':'전체 OLS 및 PI와 선택 검체 산점도'}"><path d="M95 45 V265 H520" fill="none" stroke="#70859c"/>`;
  for(let i=0;i<=4;i++){const a=loX+(hiX-loX)*i/4,b=loY+(hiY-loY)*i/4;svg+=`<text x="${x(a)}" y="284" text-anchor="middle">${esc(fmt(a))}</text><text x="86" y="${y(b)+4}" text-anchor="end">${esc(fmt(b))}</text>`;}
  if(residual&&loY<=0&&hiY>=0)svg+=`<path d="M95 ${y(0)} H520" stroke="#a6b3c0" stroke-dasharray="4 4"/>`;
  if(!residual&&model.slope!==null){
    svg+=`<path d="M${x(low)} ${y(model.intercept+model.slope*low)} L${x(high)} ${y(model.intercept+model.slope*high)}" stroke="#c0643d"/>`;
    for(const edge of ['lo','hi']){const valid=curve.filter(p=>Number.isFinite(p[edge]));if(valid.length)svg+=`<path d="${valid.map((p,i)=>`${i?'L':'M'}${x(p.x)} ${y(p[edge])}`).join(' ')}" fill="none" stroke="#668eb0" stroke-dasharray="5 4"/>`;}
  }
  svg+=points.map(p=>`<circle cx="${x(p.x)}" cy="${y(residual?p.residual:p.y)}" r="3.5" fill="${['상한 이탈','하한 이탈'].includes(p.state)?'#b85b38':'#2b679a'}" fill-opacity=".7"><title>${esc(p.id)} / 행 ${p.sourceRow} / ${fmt(p.x)}, ${fmt(residual?p.residual:p.y)} / ${esc(p.state)}</title></circle>`).join('');
  return svg+`<text x="290" y="317" text-anchor="middle">Reference 검출값</text><text x="15" y="165" transform="rotate(-90 15 165)" text-anchor="middle">${residual?'Product 전체 기준 잔차':'Product 검출값'}</text></svg>`;
}
function piDescription(pi){return !pi.n?(pi.unavailable?'계산 불가':'대상 없음'):!pi.outliers?'PI 이탈 없음':`상한 ${pi.upper} / 하한 ${pi.lower}`;}
function renderNumeric(){
  const n=snapshot.model,s=summary;
  $('numeric').innerHTML='<h2>전체 회귀 기준과 선택 검체</h2>'+
    `<p class="hint">전체 입력의 적격·양쪽 Positive·두 숫자 검체로 기준 모델을 만듭니다. 표시 범위를 바꿔도 회귀선·잔차·PI 기준은 유지합니다. 현재 선택 양성 수치쌍 ${s.numeric.n}개 / 전체 모델 ${n.n}개.</p>`+
    table(['전체 기준 모델','값',`${snapshot.confidence*100}% CI`],[['양성 수치 쌍 n',n.n,''],['Pearson r',fmt(n.r),ci(n.rCI)],['R²',fmt(n.r2),''],['OLS 기울기',fmt(n.slope),ci(n.slopeCI)],['OLS 절편',fmt(n.intercept),ci(n.interceptCI)],['잔차 표준오차',fmt(n.se),'']])+
    (n.slope===null?'<p class="hint">회귀식을 계산할 수 없습니다.</p>':`<p>전체 기준: Product = ${fmt(n.intercept)} + ${fmt(n.slope)} × Reference</p>`)+
    n.reasons.map(r=>`<p class="hint">${esc(r)}</p>`).join('')+
    `<div class="plots"><div><h3>산점도 · 전체 OLS와 ${snapshot.piLevel*100}% PI</h3>${chart(selected)}<p class="hint">실선: 전체 OLS / 점선: PI / 주황 점: PI 이탈 검체</p></div><div><h3>전체 기준 잔차</h3>${chart(selected,true)}<p class="hint">검체의 Product 값 − 전체 회귀 예상값</p></div></div>`+
    '<h3>선택 검체의 PI 검토</h3>'+table(['양성 수치쌍','PI 계산 가능','계산 불가','이탈 / 계산 가능','이탈률','전체 기준 잔차 평균','이탈 검체 평균 초과량','상태'],[[s.numeric.n,s.pi.n,s.pi.unavailable,`${s.pi.outliers} / ${s.pi.n}`,pct(s.pi.rate),fmt(s.pi.residualMean),fmt(s.pi.meanExcess),piDescription(s.pi)]])+
    '<p class="hint">PI 이탈은 추가 검토 대상입니다. 검체를 자동 제외하지 않습니다. 같은 자료로 만든 모델에 대한 탐색적 비교이며 새 검체 성능이나 검사법 동등성을 판정하지 않습니다.</p>';
}
function renderGroups(){
  const view=(kind,title,cuts)=>{
    const gs=kind==='date'&&!selected.some(r=>r.eligible&&r.date)?[]:groups(selected,kind,cuts,snapshot.confidence,snapshot.method,snapshot.model);
    if(!gs.length)return `<h3>${title}</h3><p class="hint">채취일이 없어 날짜별 분석을 할 수 없습니다. 다른 분석은 유지됩니다.</p>`;
    return `<h3>${title}</h3>${kind==='date'?barChart(agreementBars(gs),['PPA','NPA'],title+' PPA / NPA'):barChart(detectionBars(gs),['Product'],title+' 검출률')}`+
      (kind==='date'?table(['구간','PPA 양성 / 분모','PPA',`${snapshot.confidence*100}% PPA CI`,'NPA 음성 / 분모','NPA',`${snapshot.confidence*100}% NPA CI`,'유효 정성 n','정성 제외'],gs.map(g=>{const s=g.summary;return [g.label,`${s.ppa.k} / ${s.ppa.n}`,pct(s.ppa.p),pci(s.ppa),`${s.npa.k} / ${s.npa.n}`,pct(s.npa.p),pci(s.npa),s.valid,s.excluded];})):table(['구간','Reference 양성 n','Product 검출 / 유효 n','미검출 n','검출률',`${snapshot.confidence*100}% CI`,'Product Invalid','미입력','미인식'],gs.map(g=>{const s=g.summary;return [g.label,s.refPositive,`${s.detection.k} / ${s.detection.n}`,s.FN,pct(s.detection.p),pci(s.detection),s.productInvalid,s.productMissing,s.productUnknown];})))+
      '<details class="group-details"><summary>구간별 정성 일치도·수치 관계·잔차·PI</summary>'+
      table(['구간','유효 정성 n','NPA',`${snapshot.confidence*100}% NPA CI`,'양성 수치쌍 n','그룹 Pearson r','그룹 OLS 기울기','수치쌍 Ref 평균','수치쌍 Product 평균','전체 기준 잔차 평균','PI 계산 가능','이탈 / 계산 가능','이탈률','평균 초과량','PI 상태'],gs.map(g=>{const s=g.summary;return [g.label,s.valid,pct(s.npa.p),pci(s.npa),s.numeric.n,fmt(s.numeric.r),fmt(s.numeric.slope),fmt(s.numeric.xMean),fmt(s.numeric.yMean),fmt(s.pi.residualMean),s.pi.n,`${s.pi.outliers} / ${s.pi.n}`,pct(s.pi.rate),fmt(s.pi.meanExcess),piDescription(s.pi)];}))+'</details>';
  };
  $('groups').innerHTML='<h2>구간별 검출률과 경향</h2><p class="hint">검출률은 Reference 양성 중 Product 유효 결과가 있는 검체 기준입니다. ND·Negative는 미검출이며 Invalid·미입력·미인식은 분모에 포함하지 않습니다. CI는 표에 표시하며 막대그래프에서는 생략합니다.</p>'+
    '<p class="hint">표시 범위 안에서 비교합니다. 같은 Reference 구간을 선택한 뒤 날짜 그래프를 보면 검체 구성 차이를 줄여 살펴볼 수 있습니다. 날짜 차이만으로 원인이나 수집기관을 추정하지 않습니다.</p>'+
    view('ct','Reference 검출값 구간',snapshot.ct)+`<p class="hint">분석 적격 검체 중 Reference 수치 없음 ${summary.xMissing}개는 검출값 구간에서만 제외됩니다.</p>`+
    view('date',dateMode(snapshot.dates),snapshot.dates)+`<p class="hint">분석 적격 검체 중 채취일 없음 ${summary.dateMissing}개는 날짜 구간에서만 제외됩니다.</p>`;
}
const dist=d=>d.n?`${fmt(d.median)} [${fmt(d.q1)}–${fmt(d.q3)}]`:'—';
const notesHTML=key=>'<details class="interpretation"><summary>해석 참고</summary>'+NOTES[key].map(n=>`<p>${esc(n)}</p>`).join('')+'</details>';
function renderMedian(){
  const all=medianSummary(selected),gs=snapshot.median.length?medianGroups(selected,snapshot.median):[],dates=selected.some(r=>r.eligible&&r.date)?medianDateGroups(selected,snapshot.dates):[];
  const grid=(data,title)=>`<h3>${title}</h3>`+barChart(medianBars(data),['Reference','Product'],title,false)+table(['구간','전체 Reference n','전체 Reference Median [Q1–Q3]','양성 수치쌍 n','Paired Reference Median [Q1–Q3]','Paired Product Median [Q1–Q3]','참고'],data.map(g=>[g.label,g.all.n,dist(g.all),g.reference.n,dist(g.reference),dist(g.product),g.reference.n===0?'양성 수치쌍 없음':g.reference.n<10?'수치쌍 10개 미만 — 해석 주의':'']));
  $('median').innerHTML='<h2>중앙값 · 사분위수 비교</h2><p class="hint">막대는 동일 검체쌍 Reference·Product의 중앙값입니다. 전체 Reference 분포와 Q1–Q3는 표에서 함께 확인합니다.</p>'+grid([{label:'현재 표시 범위 전체',...all},...gs],'Reference 구간별 중앙값')+(dates.length?grid(dates,snapshot.dates.length?'채취일 구간별 중앙값':'채취일별 중앙값 — 구간 경계 미설정'):'<p class="hint">채취일이 없어 날짜별 중앙값을 분석할 수 없습니다. 다른 분석은 유지됩니다.</p>')+notesHTML('median');
}
function listed(){
  if(rowMode==='id-excluded')return snapshot.rows.filter(r=>!r.id);
  if(rowMode==='format-excluded')return snapshot.rows.filter(r=>r.inputErrors.length);
  return selected.filter(r=>rowMode==='all'||rowMode==='discordant'&&['FP','FN'].includes(r.cls)||rowMode==='issues'&&r.issues.length||rowMode==='numeric-excluded'&&!r.pair||rowMode==='pi-outliers'&&['상한 이탈','하한 이탈'].includes(evaluateRow(r,snapshot.model).state)||rowMode==='pi-unavailable'&&r.pair&&evaluateRow(r,snapshot.model).state==='계산 불가');
}
function rowData(r){
  const e=evaluateRow(r,snapshot.model);
  return [r.sourceRow,...r.raw.map((v,i)=>i===3&&r.x!==null?fmt(r.x):i===5&&r.y!==null?fmt(r.y):v),r.eligible?'포함':!r.id?'ID 누락 제외':'형식 오류 제외',r.qual?(r.cls==='TP'||r.cls==='TN'?'일치':'불일치'):'정성 제외',r.pair?'포함':'제외',fmt(e.fit),fmt(e.residual),fmt(e.lo),fmt(e.hi),e.state,fmt(e.excess),r.issues.join('; ')||''];
}
const rowHeaders=['원래 행',...HEADERS,'입력 적격','정성 비교','양성 수치쌍','전체 예상값','전체 잔차','PI 하한','PI 상한','PI 상태','초과량','누락·확인 사항'];
function renderRows(){
  const rows=listed(),max=Math.max(0,Math.ceil(rows.length/100)-1);page=Math.min(page,max);
  $('rows').innerHTML='<h2>검체 목록</h2><label>표시할 검체<select id="row-mode"><option value="all">현재 표시 범위 전체</option><option value="discordant">정성 불일치</option><option value="issues">누락·확인 사항 있음</option><option value="numeric-excluded">수치 분석 제외</option><option value="pi-outliers">PI 이탈</option><option value="pi-unavailable">PI 계산 불가</option><option value="id-excluded">전체 입력의 ID 누락 제외</option><option value="format-excluded">전체 입력의 형식 오류 제외</option></select></label>'+
    `<p class="hint">${['id-excluded','format-excluded'].includes(rowMode)?'입력 제외 목록은 현재 필터와 관계없이 전체 입력에서 표시합니다.':'현재 표시 범위의 검체입니다.'} 원행은 삭제하지 않고 중복 ID를 합치지 않습니다. 복사는 선택한 목록 전체를 포함합니다.</p>`+
    table(rowHeaders,rows.slice(page*100,page*100+100).map(rowData))+
    `<div class="pager"><button id="previous" ${page===0?'disabled':''}>이전</button><span>${rows.length}개 · ${rows.length?page*100+1:0}–${Math.min(rows.length,(page+1)*100)} 표시</span><button id="next" ${page===max?'disabled':''}>다음</button></div>`;
  $('row-mode').value=rowMode;$('row-mode').onchange=()=>{rowMode=$('row-mode').value;page=0;renderRows();$('copy-status').textContent='';};$('previous').onclick=()=>{page--;renderRows();};$('next').onclick=()=>{page++;renderRows();};
}
$('copy').onclick=async()=>{
  if(!snapshot)return;
  const current=snapshot,rev=revision,copyTab=tab,scope=$('scope').textContent;
  const info=[['검사법 비교 분석',VERSION],['입력',snapshot.source],['표시 범위',scope],['포함 기준','ID·입력 형식 유효 / 정성: 유효 결과 쌍 / 수치: 양쪽 Positive + 두 유효 숫자'],['전체 기준 모델 n',snapshot.model.n],['PI 수준',`${snapshot.piLevel*100}%`],['기준 모델','전체 입력 고정 OLS — 필터로 재적합하지 않음'],['표시 원행 n',summary.total],['ID 유효 n',summary.eligible],['전체 입력 ID 누락 제외',snapshot.rows.filter(r=>!r.id).length],['전체 입력 형식 오류 제외',snapshot.rows.filter(r=>r.id&&r.inputErrors.length).length],['유효 정성 n',summary.valid],['양성 수치쌍 n',summary.numeric.n],['정성 제외',summary.excluded],['수치 제외',summary.total-summary.numeric.n],['날짜 없음/오류',summary.dateMissing],['검출값 경계',snapshot.ct.join(', ')||'전체'],['Median 경계',snapshot.median.join(', ')||'전체'],['채취일 분석 방식',dateMode(snapshot.dates)],...snapshot.dates.map((date,i)=>['D'+(i+1),date]),...dateLabels(snapshot.dates).map((label,i)=>['채취일 구간 '+(i+1),label])];
  let html=table(['분석 정보','값'],info);
  if(tab==='rows')html+=`<p>${['id-excluded','format-excluded'].includes(rowMode)?'입력 제외 목록: 전체 입력 기준':'목록: 현재 표시 범위 기준'}</p>`+table(rowHeaders,listed().map(rowData));
  else html+=Array.from($(tab).querySelectorAll('h2,h3,p,summary,table')).filter(el=>!el.closest('svg')).map(el=>el.tagName==='SUMMARY'?`<h3>${esc(el.textContent)}</h3>`:el.outerHTML).join('');
  const div=document.createElement('div');div.innerHTML=html;
  const text=Array.from(div.querySelectorAll('tr,p,h2,h3')).map(el=>el.tagName==='TR'?Array.from(el.children).map(c=>c.textContent.replace(/[\t\r\n]+/g,' ')).join('\t'):el.textContent).join('\n');
  html=`<div style="font-family:Malgun Gothic;font-size:9pt">${html.replaceAll('<table>','<table style="border-collapse:collapse;font-family:Malgun Gothic;font-size:9pt">')}</div>`;
  try{if(globalThis.ClipboardItem)await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([text],{type:'text/plain'}),'text/html':new Blob([html],{type:'text/html'})})]);else await navigator.clipboard.writeText(text);if(snapshot===current&&revision===rev&&tab===copyTab&&$('scope').textContent===scope)$('copy-status').textContent='복사했습니다.';}
  catch{$('copy-status').textContent='클립보드 접근을 허용한 뒤 다시 복사하세요.';}
};

$('export').onclick=async()=>{
  if(!snapshot)return;
  const current=snapshot,rev=revision,scope=$('scope').textContent,rows=selected.slice();
  const titleSize=Number($('report-title-size').value),emphasisSize=Number($('report-emphasis-size').value);
  if(!(titleSize>=9&&titleSize<=24&&emphasisSize>=9&&emphasisSize<=18)){$('export-status').textContent='제목은 9–24pt, 강조는 9–18pt로 입력하세요.';return;}
  $('export').disabled=true;$('export-status').textContent='그래프를 포함한 리포트를 만들고 있습니다.';
  try{
    const blob=await exportReport(current,rows,scope,{titleSize,emphasisSize});
    if(snapshot!==current||revision!==rev||$('scope').textContent!==scope){$('export-status').textContent='분석 내용이 변경되어 저장하지 않았습니다. 현재 결과로 다시 저장하세요.';return;}
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='검사법_비교_리포트_'+new Date().toISOString().slice(0,10)+'.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);$('export-status').textContent='Excel 리포트를 저장했습니다.';
  }catch(e){$('export-status').textContent='리포트 저장 실패: '+e.message;}finally{$('export').disabled=!snapshot;}
};
