/* Minimum request + browser R point candidate. Existing CI method only. */
'use strict';
window.LoDRequest=(()=>{
 const method={id:'binomial-probit-log10',source:'CLSI EP17-A2 (2012), §5.5.3.2; log10는 제품 선택',implementation:'unconnected',ciStatus:'held',fitAssessmentStatus:'held'};
 function build(snapshot){
  const s=structuredClone(snapshot),errors=[...s.errors];
  if(s.data.module!=='lod')errors.push('LoD 입력만 지원합니다.');
  const rows=s.data.rows||[],seen=new Set();
  for(const r of rows){if(seen.has(r.concentration))errors.push('같은 농도가 여러 행에 있습니다. 분석 집단을 확인하고 농도별 한 행으로 정리하세요. 자동 합산하지 않습니다.');seen.add(r.concentration);}
  // Two distinct doses are a model rank requirement, not a study-design minimum.
  if(seen.size<2)errors.push('Probit 요청에는 서로 다른 양의 농도 2개 이상이 필요합니다. 이는 시험설계 충족 기준이 아닙니다.');
  const observations=s.errors.length?[]:rows.map(r=>({...r,negative:r.n-r.positive,observedRate:r.positive/r.n}));
  return {version:'minimal-lod-request-1',status:errors.length?'input_blocked':'method_held',errors:[...new Set(errors)],warnings:s.warnings,
   request:errors.length?null:{c:rows.map(r=>r.concentration),k:rows.map(r=>r.positive),n:rows.map(r=>r.n),target:s.data.setting},
   observations,method:{...method},input:s,point:null,ci:null,
   limitations:['입력 요약만으로 LoD를 추정하지 않습니다. 후보값 계산은 별도 실행하며 근사 CI 상태는 계산 결과에서 확인합니다. 최종 적합도는 검토가 필요합니다.','한 분석 집단의 정리된 건수입니다. 원자료·시험설계·허가 적합성을 검증하지 않았습니다.']};
 }
 const p=document.getElementById('lod'),aside=document.querySelector('aside'),box=document.createElement('section');box.id='lod-request-result';box.dataset.analysisResult='';box.hidden=true;aside.querySelector('.empty').after(box);
 const button=p.querySelector('button[disabled]');button.disabled=false;button.textContent='LoD 입력 요약 / 계산 준비 확인';button.id='lod-prepare';p.querySelector('.context').append(button);
 const run=document.createElement('button');run.id='lod-run';run.textContent='LoD 분석 실행';p.querySelector('.context').nextElementSibling.append(run);
 const available=['http:','https:'].includes(location.protocol);
 run.disabled=!available;run.title=available?'브라우저 R Probit · 적합도 검토 전 후보값':'HTTP/HTTPS 페이지에서 계산할 수 있습니다.';
 const stop=document.createElement('button');stop.id='lod-cancel';stop.textContent='계산 취소';stop.hidden=true;run.after(stop);
 const connection=document.createElement('p');connection.className='hint';connection.textContent=available?'브라우저에서 계산 · 첫 실행 시 R/CI 라이브러리를 다운로드합니다. 분석 입력은 서버로 전송하지 않습니다. Excel 결과서도 브라우저에서 생성합니다.':'파일 모드: 입력 확인만 가능합니다. HTTP/HTTPS 페이지에서 계산하세요.';stop.after(connection);
 let serial=0,controller=null;
 let result=null,fingerprint=null;
 const current=()=>{const s=MinimalInputs.snapshot('lod');return JSON.stringify([s.raw,s.revision]);};
 const make=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
 function draw(){document.dispatchEvent(new Event('analysis-result-change'));const active=document.querySelector('nav [aria-pressed="true"]').dataset.module==='lod';box.hidden=!active||!result;aside.querySelector('.empty').hidden=[...aside.querySelectorAll('[data-analysis-result]')].some(e=>!e.hidden);if(!active||!result)return;
  box.replaceChildren();const fresh=current()===fingerprint;box.append(make('h3',fresh?(result.execution?'LoD 모형 계산':'LoD 입력 요약'):'입력 변경 · 다시 확인 필요'));
  if(!fresh){box.append(make('p','이전 요약은 숨겼습니다. 현재 입력으로 다시 확인하세요.'));return;}
  box.append(make('p',result.status==='input_blocked'?'계산 요청 차단 · 입력 보완 필요':result.execution?'계산 완료':result.pending?(result.progress||'계산 준비 중…'):'입력 대응 완료 · 브라우저 후보값 계산 가능'));
  for(const e of [...result.errors,...result.warnings])box.append(make('p',e));
  box.append(make('p',`${result.input.data.dataKind?('자료: '+result.input.data.dataKind+' · '):''}단위: ${result.input.data.unit||'미기재'}`));
  if(result.observations.length){const wrap=make('div','');wrap.className='scroll';const table=make('table','');table.setAttribute('aria-label','LoD 농도별 관측 결과');const head=make('thead',''),tr=make('tr','');for(const h of ['농도','N','양성','관측률 (%)']){const th=make('th',h);th.scope='col';tr.append(th);}head.append(tr);table.append(head);const body=make('tbody','');for(const r of result.observations){const tr=make('tr','');for(const v of [r.concentration,r.n,r.positive,(r.observedRate*100).toFixed(2)])tr.append(make('td',String(v)));body.append(tr);}table.append(body);wrap.append(table);box.append(wrap);}
  box.append(make('p',`목표 검출확률: ${result.input.raw.setting||'미기재'}%`));

  if(result.executionError){const e=make('p',result.executionError);e.setAttribute('role','alert');box.append(e);}
  if(result.execution){const e=result.execution,labels={all_one_outcome:'모든 결과가 양성 또는 음성이어서 추정할 수 없습니다.',separation:'결과가 완전히 또는 준완전히 분리돼 유한한 계수를 추정하지 않습니다.',nonconvergence:'계산이 수렴하지 않았습니다.',rank_or_coefficient:'계수를 안정적으로 추정하지 못했습니다.',nonpositive_slope:'농도 증가에 따른 양의 기울기를 추정하지 못했습니다.',numeric_range:'수치 계산 범위를 벗어났습니다.',input_blocked:'계산 입력 범위를 확인하세요.',execution_failed:'R 계산에 실패했습니다.'};
   box.append(make('h3',e.status==='candidate'?`모형 후보값: ${e.modelDoseCandidate.toPrecision(6)} ${result.input.data.unit}`:'후보값 미제공'));
   box.append(make('p',LoDCIContract.describe(e.ci)+(e.ci.status==='calculated'?' '+result.input.data.unit:'')));
   box.append(make('p','모형·정규근사 조건부 구간 · 적합도/근사 적용성 검토 전 · 최종 LoD/허가 적합 판정 아님'));
   if(e.ci.warnings.length)box.append(make('p','CI 끝점이 시험 농도 범위를 벗어납니다. 구간을 자르지 않고 표시합니다.'));
   if(e.status!=='candidate')box.append(make('p',labels[e.status]||'추정할 수 없습니다.'));
   if(e.status==='candidate'){

    const notes={EXTRAPOLATED:'시험 농도 범위 밖 후보값(외삽)입니다.',NO_RESIDUAL_DF:'잔차 자유도가 없어 적합도를 평가할 수 없습니다.',R_WARNING:'R 경고가 발생했습니다. 결과 검토가 필요합니다.',R_STDERR:'실행 환경 메시지가 발생했습니다. 환경 검토가 필요합니다.'};
    for(const code of e.diagnostics)box.append(make('p',notes[code]||code));
    const more=make('details','');more.append(make('summary','모형 진단·계산 버전'));more.append(make('p',`수렴: 확인 · 잔차 자유도: ${e.residualDF} · Deviance: ${e.deviance.toPrecision(5)} · Pearson: ${e.pearson.toPrecision(5)}`));
    more.append(make('p',`브라우저 webR ${e.method.webRVersion} · R ${e.method.rVersion} · stats ${e.method.statsVersion} · MASS ${e.method.massVersion} · 프로그램 ${e.method.applicationVersion}`));
    more.append(make('p',`wrapper ${e.method.wrapperVersion} · ${e.method.link}/${e.method.scale} · 목표 ${e.method.target}`));
    for(const [label,value]of [['CI 방법',e.ci.method.id],['CI 근거',e.ci.method.source],['CI 방법 버전',e.ci.method.version],['신뢰수준',e.ci.confidence],['log10 추정값',e.ci.logEstimate],['log10 표준오차',e.ci.logSE],['log10 하한',e.ci.logLower],['log10 상한',e.ci.logUpper]])more.append(make('p',`${label}: ${value??'미제공'}`));
    more.append(make('p',`절편: ${e.coefficients[0]} · 기울기: ${e.coefficients[1]} · 반복: ${e.iterations}`));
    const t=make('table','');t.setAttribute('aria-label','LoD 모형 진단');const h=make('tr','');for(const title of ['농도','적합률 (%)','기대 양성','기대 음성'])h.append(make('th',title));const thead=make('thead','');thead.append(h);t.append(thead);const tbody=make('tbody','');result.observations.forEach((r,i)=>{const tr=make('tr','');for(const v of [r.concentration,e.fittedProbability[i]*100,e.expectedPositive[i],e.expectedNegative[i]])tr.append(make('td',Number(v).toPrecision(5)));tbody.append(tr);});t.append(tbody);const wrap=make('div','');wrap.className='scroll';wrap.append(t);more.append(wrap);box.append(more);
   }
  }
  const details=make('details','');details.append(make('summary','방법·입력 근거'));details.append(make('p',method.source));if(result.input.data.groupLabel)details.append(make('p',`집단: ${result.input.data.groupLabel}`));if(result.input.data.sourceReference)details.append(make('p',`원기록: ${result.input.data.sourceReference}`));
  details.append(make('p','관측률 = 양성 수 / 분석 대상 N. 목표확률을 넘은 농도를 자동으로 LoD로 선택하지 않습니다.'));
  if(result.input.source?.kind==='file')details.append(make('p',`파일: ${result.input.source.filename} · SHA-256: ${result.input.source.sha256}`));
  box.append(details);
 }
 function cancel(){serial++;controller?.abort();controller=null;run.disabled=!available;stop.hidden=true;}
 stop.onclick=()=>{cancel();if(result){result.pending=false;result.executionError='계산을 취소했습니다. 다시 실행할 수 있습니다.';}draw();};
 button.onclick=()=>{cancel();result=build(MinimalInputs.snapshot('lod'));fingerprint=current();draw();};
 run.onclick=async()=>{
  cancel();result=build(MinimalInputs.snapshot('lod'));fingerprint=current();if(!result.request){draw();return;}
  const id=serial,fp=fingerprint,q=result.request;controller=new AbortController();const signal=controller.signal;run.disabled=true;stop.hidden=false;result.pending=true;draw();
  try{const e=await BrowserLoD.run(q,{signal,onProgress:text=>{if(id===serial&&current()===fp){result.progress=text;draw();}}});
   if(id!==serial||current()!==fp)return;
   if(e.version!=='lod-point-2'||e.reportableLoD!==null||e.fitAssessment!=='review_required'||!Array.isArray(e.diagnostics))throw Error('invalid_response');
   if(e.status==='candidate'&&(!(e.modelDoseCandidate>0)||!Number.isFinite(e.modelDoseCandidate)||!e.method||e.method.target!==result.request.target||!['deviance','pearson','residualDF','iterations'].every(k=>Number.isFinite(e[k]))||!['fittedProbability','expectedPositive','expectedNegative'].every(k=>Array.isArray(e[k])&&e[k].length===result.observations.length&&e[k].every(Number.isFinite))||!Array.isArray(e.coefficients)||e.coefficients.length!==2||!e.coefficients.every(Number.isFinite)))throw Error('invalid_response');
   if(!LoDCIContract.valid(e.ci,e,result.request.c))throw Error('invalid_response');
   if(e.curve!==undefined&&e.curve!==null&&!LoDCurveContract.valid(e.curve,result.request.c))throw Error('invalid_response');
   result.execution=e;p.querySelector('.input-feedback').textContent='브라우저 R 계산 완료 · 최종 LoD 미확정';
  }catch(e){if(id===serial&&current()===fp){const messages={input_blocked:'계산 입력 범위를 확인하세요(N은 행당 최대 10억).',busy:'다른 계산이 실행 중입니다. 잠시 후 다시 실행하세요.',invalid_response:'계산 응답을 검증하지 못했습니다.',runtime_version_mismatch:'검증한 계산 환경 버전과 달라 계산을 차단했습니다.',startup_timeout:'계산 환경 준비 제한시간(60초)을 초과했습니다. 네트워크 연결을 확인하고 다시 실행하세요.',calculation_timeout:'계산 제한시간(20초)을 초과했습니다. 다시 실행하세요.',aborted:'계산을 취소했습니다.'};result.executionError=messages[e.message]||'브라우저 계산 환경을 준비하거나 실행하지 못했습니다. 네트워크 연결을 확인하고 다시 실행하세요.';}}
  finally{if(id===serial){result.pending=false;controller=null;run.disabled=!available;stop.hidden=true;draw();}}
 };
 document.addEventListener('minimal-input-change',()=>{if(result&&current()!==fingerprint){cancel();result.pending=false;}draw();});document.addEventListener('minimal-module-change',draw);
 return {build,snapshot:()=>result?{...structuredClone(result),fresh:current()===fingerprint}:null};
})();
