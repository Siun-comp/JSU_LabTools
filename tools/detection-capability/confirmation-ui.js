'use strict';
window.ConfirmationResults=(()=>{
 const panel=document.getElementById('confirmation'),aside=document.querySelector('aside'),empty=aside.querySelector('.empty');
 const make=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
 const box=make('section','');box.id='confirmation-result';box.dataset.analysisResult='';box.hidden=true;box.style.overflowWrap='anywhere';empty.after(box);
 const run=panel.querySelector('button[disabled]');run.id='confirmation-run';run.textContent='관측률·신뢰구간 계산';
 const available=['http:','https:'].includes(location.protocol);run.disabled=!available;
 const stop=make('button','계산 취소');stop.id='confirmation-cancel';stop.hidden=true;run.after(stop);
 const hint=make('p',available?'브라우저에서 계산합니다. 양측 95% Clopper–Pearson CI는 불확실성 표시이며 사전 관측률 기준과 구분합니다. CI 하한으로 판정하지 않습니다.':'파일 모드에서는 입력 확인만 가능합니다. HTTP/HTTPS 페이지에서 계산하세요.');hint.className='hint';stop.after(hint);
 let result=null,fingerprint=null,serial=0,controller=null;
 const current=()=>{const s=MinimalInputs.snapshot('confirmation');return JSON.stringify([s.raw,s.revision]);};
 function build(input){const errors=[...input.errors],rows=input.data.rows||[],seen=new Set();for(const r of rows){if(seen.has(r.concentration))errors.push('같은 농도의 여러 행은 자동 합산하지 않습니다. 분석 집단을 확인하고 농도별 한 행으로 정리하세요.');seen.add(r.concentration);if(r.n>1e9)errors.push('현재 지원은 행당 N 최대 10억입니다.');}
  return {input,errors:[...new Set(errors)],request:errors.length?null:{c:rows.map(r=>r.concentration),k:rows.map(r=>r.positive),n:rows.map(r=>r.n),criterion:input.data.setting}};
 }
 function draw(){document.dispatchEvent(new Event('analysis-result-change'));const active=document.querySelector('nav [aria-pressed="true"]').dataset.module==='confirmation';box.hidden=!active||!result;empty.hidden=[...aside.querySelectorAll('[data-analysis-result]')].some(e=>!e.hidden);if(box.hidden)return;
  box.replaceChildren();if(current()!==fingerprint){box.append(make('h3','입력 변경 · 다시 계산 필요'),make('p','이전 관측률·신뢰구간·기준 판정은 숨겼습니다.'));return;}
  box.append(make('h3','LoD 검출률 확인'));
  for(const t of [...result.errors,...result.input.warnings])box.append(make('p',t));
  if(result.pending)box.append(make('p',result.progress||'브라우저 신뢰구간 계산 중…'));
  if(result.error){const e=make('p',result.error);e.setAttribute('role','alert');box.append(e);}
  const d=result.input.data;box.append(make('p',`${d.dataKind?('자료: '+d.dataKind+' · '):''}단위: ${d.unit||'미기재'}`));
  if(result.execution){const e=result.execution;
   panel.querySelector('.input-feedback').textContent=`관측률·신뢰구간 계산 완료`;
   box.append(make('p',`사전 관측률 기준: ${e.criterion===null?'미설정':e.criterion*100+'%'} · 비교는 반올림 전 관측률 ≥ 기준`));
   for(const r of e.rows){const card=make('section','');card.className='confirmation-row';card.append(make('h3',`농도 ${r.concentration} ${d.unit}`));card.append(make('p',`양성 ${r.positive} / N ${r.n} · 음성 ${r.negative}`));card.append(make('p',`관측 검출률: ${(100*r.observedRate).toFixed(2)}%`));card.append(make('p',`양측 95% CI: ${(100*r.ci.lower).toFixed(2)}–${(100*r.ci.upper).toFixed(2)}%`));card.append(make('p',`관측률 기준: ${{met:'충족',not_met:'미충족',not_set:'미설정 · 판정하지 않음'}[r.criterionStatus]}`));box.append(card);}
   box.append(make('p','CI 하한에 대한 판정이나 최종 LoD 선정이 아닙니다. 원자료·독립성·시험설계·계획 반복 수·허가 적합성은 검증하지 않았습니다.'));
   const detail=make('details','');detail.append(make('summary','방법·원값·입력 근거'));detail.append(make('p',`${e.method.source} · 양측 95% · wrapper ${e.method.wrapperVersion} · R ${e.method.rVersion} · stats ${e.method.statsVersion}`));
   detail.append(make('p',`브라우저 webR ${e.method.webRVersion} · 프로그램 ${e.method.applicationVersion}`));
   if(d.groupLabel)detail.append(make('p',`집단: ${d.groupLabel}`));if(d.sourceReference)detail.append(make('p',`원기록: ${d.sourceReference}`));detail.append(make('p','정리된 양성/음성 N의 이항모형입니다. 미해결 결과를 음성으로 대체하지 않으며 여러 농도를 합산하지 않습니다. EP17 §7 자동 검증이 아닙니다.'));
   for(const r of e.rows)detail.append(make('p',`농도 ${r.concentration}: 관측률 ${r.observedRate}; CI [${r.ci.lower}, ${r.ci.upper}]`));
   if(result.input.source?.kind==='file')detail.append(make('p',`파일: ${result.input.source.filename} · SHA-256: ${result.input.source.sha256}`));box.append(detail);
  }
 }
 function cancel(){serial++;controller?.abort();controller=null;run.disabled=!available;stop.hidden=true;}
 stop.onclick=()=>{cancel();if(result){result.pending=false;result.error='계산을 취소했습니다. 다시 실행할 수 있습니다.';}draw();};
 run.onclick=async()=>{cancel();result=build(MinimalInputs.snapshot('confirmation'));fingerprint=current();if(!result.request){draw();return;}
  const id=serial,fp=fingerprint,q=result.request;controller=new AbortController();const signal=controller.signal;result.pending=true;run.disabled=true;stop.hidden=false;draw();
  try{const e=await BrowserContinuous.run('confirmation',q,{signal,onProgress:text=>{if(id===serial&&current()===fp){result.progress=text;draw();}}});if(id!==serial||current()!==fp)return;if(!ConfirmationContract.validResponse(e,q))throw Error('invalid_response');result.execution=e;}
  catch(e){if(id===serial&&current()===fp)result.error=BrowserRRuntime.message(e);}
  finally{if(id===serial){result.pending=false;controller=null;run.disabled=!available;stop.hidden=true;draw();}}
 };
 document.addEventListener('minimal-input-change',()=>{if(result&&current()!==fingerprint){cancel();result.pending=false;}draw();});document.addEventListener('minimal-module-change',draw);
 return {build,snapshot:()=>result?{...structuredClone(result),fresh:current()===fingerprint}:null};
})();
