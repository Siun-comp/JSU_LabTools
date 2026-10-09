export function dateBounds(values){
  const dates=[];let gap=false;
  for(const [i,value] of values.entries()){
    if(!value){gap=true;continue;}
    if(gap)throw Error(`D${i+1} 앞에 빈 경계가 있습니다. D1부터 순서대로 입력하세요.`);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error(`D${i+1}에 유효한 날짜를 입력하세요.`);
    const d=new Date(value+'T00:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value||value<'1900-01-01')throw Error(`D${i+1}에 유효한 날짜를 입력하세요.`);
    if(dates.length&&value<=dates.at(-1))throw Error(`D${i+1}은 D${i}보다 뒤의 날짜여야 합니다. 중복·역순을 확인하세요.`);
    dates.push(value);
  }
  return dates;
}
export const dateLabels=cuts=>cuts.length?cuts.map((date,i)=>i===0?`${date} 이전`:`${cuts[i-1]} 이상 ~ ${date} 미만`).concat(`${cuts.at(-1)} 이상`):[];
export const dateMode=cuts=>cuts.length?'채취일 구간별 분석':'채취일별 분석 — 구간 경계 미설정';
export function initDateBoundaries(container,onChange){
  const inputs=Array.from(container.querySelectorAll('input[type="date"]')),message=container.querySelector('[role="status"]');
  const get=()=>{const bad=inputs.findIndex(i=>i.validity.badInput);if(bad!==-1)throw Error(`D${bad+1}에 날짜를 완성하거나 지우세요.`);return dateBounds(inputs.map(i=>i.value));};
  const update=()=>{
    try{const cuts=get(),ranges=dateLabels(cuts);message.textContent=cuts.length?`경계 ${cuts.length}개 · 분석 구간 ${cuts.length+1}개 · 경계 날짜는 다음 구간에 포함합니다.`:dateMode(cuts);message.classList.remove('warning');
      inputs.forEach((input,i)=>container.querySelector(`[data-date-description="${i}"]`).textContent=i<cuts.length?ranges[i]:'미설정');
      container.querySelector('[data-last-range]').textContent=cuts.length?'마지막 구간: '+ranges.at(-1):'경계를 지정하면 실제 날짜 범위를 표시합니다.';
    }catch(e){message.textContent=e.message;message.classList.add('warning');container.querySelectorAll('[data-date-description]').forEach(el=>el.textContent='경계를 확인하세요.');container.querySelector('[data-last-range]').textContent='';}
  };
  inputs.forEach(input=>input.addEventListener('input',()=>{update();onChange();}));
  container.querySelectorAll('[data-clear-date]').forEach(button=>button.onclick=()=>{inputs[Number(button.dataset.clearDate)].value='';update();onChange();});
  update();return {get};
}
