/* Confirmation planning table (reference only). Computed in browser R (stats::pbinom / stats::qbeta,
 * the same Clopper–Pearson form as the confirmation program). No pass/fail decision, no criterion. */
'use strict';
(function(root){
 const PRESETS=[10,20,24,30,40,60],DEFAULT_SELECTED=[20,24,30,60],MISSES=[0,1,2,3];
 function validate(q){return !!q&&Number.isFinite(q.p)&&q.p>0&&q.p<1&&Array.isArray(q.n)&&q.n.length>=1&&q.n.length<=12&&new Set(q.n).size===q.n.length&&q.n.every(n=>Number.isSafeInteger(n)&&n>=1&&n<=10000);}
 function decode(output,q,env,stderr){
  if(stderr)throw Error('execution_failed');
  const f={};if(typeof output!=='string'||output.length>100000)throw Error('invalid_response');
  for(const line of output.trim().split(/\r?\n/)){const parts=line.split('\t');if(parts.length!==2||Object.hasOwn(f,parts[0]))throw Error('invalid_response');f[parts[0]]=parts[1];}
  if(f.status!=='calculated')throw Error('execution_failed');
  if(f.rVersion!==env.rVersion||f.statsVersion!==env.statsVersion)throw Error('invalid_response');
  const size=q.n.length*MISSES.length,vector=(k,len=size)=>{const v=f[k]?.split(',');if(v?.length!==len||v.some(x=>!x.trim()||!Number.isFinite(Number(x))))throw Error('invalid_response');return v.map(Number);};
  const n=vector('n'),miss=vector('miss'),valid=vector('valid'),atLeast=vector('atLeast'),cp=vector('cpLower'),expected=vector('expected',q.n.length);
  const rows=q.n.map((count,i)=>({n:count,expected:expected[i],cells:MISSES.map((m,j)=>{const at=i*MISSES.length+j;if(n[at]!==count||miss[at]!==m)throw Error('invalid_response');
   if(!valid[at])return null;if(!(atLeast[at]>=0&&atLeast[at]<=1&&cp[at]>=0&&cp[at]<=1))throw Error('invalid_response');return {misses:m,detections:count-m,atLeast:atLeast[at],cpLower:cp[at]};})}));
  return {version:'confirmation-plan-1',p:q.p,rows,method:{id:'binomial-plan-clopper-pearson-95',source:'stats::pbinom (upper tail) / stats::qbeta two-sided 95% Clopper–Pearson lower bound',...env}};
 }
 function create(options={}){const source=options.source||root.ConfirmationPlanSource,runtime=options.runtime||root.BrowserRRuntime.shared;
  const task={validate,source,needsMASS:false,label:'확인시험 계획표',encode:q=>q.p+'\n'+q.n.join('\n')+'\n',decode};return {run:(q,s)=>runtime.run(task,q,s)};}
 const api={PRESETS,DEFAULT_SELECTED,MISSES,validate,decode,create};
 if(typeof module==='object'&&module.exports){module.exports=api;return;}
 root.ConfirmationPlan={...api,...create()};
 const panel=document.getElementById('confirmation');if(!panel)return;
 const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 const box=make('details',undefined,'context plan');box.id='confirmation-plan';box.append(make('summary','확인시험 계획표 (참고 · 판정 없음)'));
 box.append(make('p','확인시험을 하기 전에, 가정한 검출 확률에서 반복 수별로 어떤 결과가 나올 수 있는지 미리 봅니다. 입력한 실험 결과와는 별개이며 합격 기준을 만들지 않습니다.','hint'));
 const pLabel=make('label','가정 검출 확률 (%) ');const pInput=make('input');pInput.type='number';pInput.min='1';pInput.max='99.9';pInput.step='0.1';pInput.value='95';pInput.id='plan-probability';pLabel.append(pInput);box.append(pLabel);
 const fieldset=make('fieldset');fieldset.append(make('legend','반복 수 후보 (눌러서 고르기)'));
 const checks=PRESETS.map(n=>{const l=make('label',undefined,'plan-preset'),c=make('input');c.type='checkbox';c.value=String(n);c.checked=DEFAULT_SELECTED.includes(n);l.append(c,document.createTextNode(' '+n+'회'));fieldset.append(l);return c;});
 box.append(fieldset);
 const extraLabel=make('label','추가 반복 수 (쉼표로 구분, 선택) ');const extra=make('input');extra.id='plan-extra';extra.placeholder='예: 36, 50';extraLabel.append(extra);box.append(extraLabel);
 const runButton=make('button','계획표 계산');runButton.type='button';runButton.id='plan-run';const status=make('p','',"hint");status.setAttribute('role','status');box.append(make('div'),runButton,status);
 const output=make('div');output.id='plan-output';box.append(output);panel.append(box);
 const available=['http:','https:'].includes(location.protocol);runButton.disabled=!available;if(!available)status.textContent='HTTP/HTTPS 페이지에서 계산할 수 있습니다.';
 function request(){const p=Number(pInput.value)/100,extras=extra.value.split(/[,\s]+/).filter(Boolean),errors=[];const n=[...checks.filter(c=>c.checked).map(c=>Number(c.value))];
  for(const t of extras){const v=Number(t);if(!Number.isSafeInteger(v)||v<1||v>10000)errors.push(`추가 반복 수 "${t}"는 1~10000의 정수가 아닙니다.`);else if(!n.includes(v))n.push(v);}
  if(!(p>0&&p<1))errors.push('가정 검출 확률은 0%보다 크고 100%보다 작아야 합니다.');if(!n.length)errors.push('반복 수를 하나 이상 고르세요.');if(n.length>12)errors.push('반복 수는 12개까지 한 번에 계산합니다.');
  return {errors,q:{p,n:n.sort((a,b)=>a-b)}};}
 const pct=v=>(v*100).toFixed(1)+'%';
 function render(r){output.replaceChildren();
  const table1=make('table');table1.setAttribute('aria-label','반복 수별 결과 확률');const h1=make('tr');for(const t of ['반복 수 n','기대 검출 수','모두 검출','미검출 1회 이하','미검출 2회 이하','미검출 3회 이하'])h1.append(make('th',t));const th1=make('thead');th1.append(h1);table1.append(th1);const b1=make('tbody');
  for(const row of r.rows){const tr=make('tr');tr.append(make('td',String(row.n)),make('td',row.expected.toFixed(1)));for(const c of row.cells)tr.append(make('td',c?pct(c.atLeast):'—'));b1.append(tr);}table1.append(b1);
  const table2=make('table');table2.setAttribute('aria-label','관측 결과별 신뢰구간 하한');const h2=make('tr');for(const t of ['반복 수 n','n/n 관측','(n−1)/n','(n−2)/n','(n−3)/n'])h2.append(make('th',t));const th2=make('thead');th2.append(h2);table2.append(th2);const b2=make('tbody');
  for(const row of r.rows){const tr=make('tr');tr.append(make('td',String(row.n)));for(const c of row.cells)tr.append(make('td',c?`${c.detections}/${row.n} → ${pct(c.cpLower)}`:'—'));b2.append(tr);}table2.append(b2);
  const w1=make('div',undefined,'scroll'),w2=make('div',undefined,'scroll');w1.append(table1);w2.append(table2);
  output.append(make('h4',`반복 수별로 나올 확률 (가정 검출 확률 ${pct(r.p)})`),w1,make('p','예: "미검출 1회 이하"는 n회 중 n−1회 이상 검출될 확률입니다. 가정한 확률이 맞다는 전제의 계산입니다.','hint'),
   make('h4','그 결과를 관측했을 때의 검출률 95% 신뢰구간 하한 (양측 Clopper–Pearson)'),w2,make('p','확인시험 계산과 같은 방식의 하한입니다. 계획 참고용이며 합격 기준이 아닙니다. 기준(예: 몇 회 이상 검출)은 사용자가 근거에 따라 정합니다.','hint'),
   make('p',`계산: 브라우저 webR ${r.method.webRVersion} · R ${r.method.rVersion} · ${r.method.source} · R 프로그램 SHA-256 ${r.method.sourceSHA256}`,'hint'));}
 let controller=null;
 runButton.onclick=async()=>{const {errors,q}=request();if(errors.length){status.textContent=errors.join(' ');output.replaceChildren();return;}
  controller?.abort();controller=new AbortController();runButton.disabled=true;status.textContent='계산 준비 중…';
  try{const r=await root.ConfirmationPlan.run(q,{signal:controller.signal,onProgress:t=>{status.textContent=t;}});render(r);status.textContent=`계산 완료 · 반복 수 ${q.n.join(', ')}회`;}
  catch(e){status.textContent=root.BrowserRRuntime.message(e);}
  finally{runButton.disabled=!available;}};
 for(const el of [pInput,extra,...checks])el.addEventListener('input',()=>{if(output.childNodes.length){output.replaceChildren();status.textContent='조건이 바뀌었습니다. 다시 계산하세요.';}});
})(globalThis);
