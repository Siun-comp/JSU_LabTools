// SPDX-License-Identifier: GPL-2.0-or-later
import {normalize,selection,moveRange,strands} from './sequence.mjs';
import {conditionsFromStrings,FIELDS} from './conditions.mjs';
import {initAnalysis} from './analysis-ui.mjs';
let analysis;
const $=id=>document.getElementById(id);
const measureCanvas=document.createElement('canvas'),measureContext=measureCanvas.getContext('2d');
const DEFAULT_CONDITIONS=Object.freeze({temperature:'60',na:'50',k:'0',nh4:'0',mg:'3',dntp:'0.8',a:'200',b:'200'});
function restoreDefaultConditions(){for(const k of FIELDS)$(k).value=DEFAULT_CONDITIONS[k];}
let parsed=normalize(''),range=null,coordinateDraft=false,lastWidth=0,selectionNotice='';
const labels={temperature:'반응 온도',na:'Na⁺',k:'K⁺',nh4:'NH₄⁺',mg:'Mg total',dntp:'dNTP total',a:'A 농도',b:'B 농도'};
function valid(){return parsed.ok&&parsed.seq.length>0&&range&&!coordinateDraft;}
function conditionsText(){return FIELDS.map(k=>`${labels[k]}: ${$(k).value.trim()||'미입력'} ${k==='temperature'?'°C':['a','b'].includes(k)?'nM':'mM'}`).join(' / ');}
function showConditions(){
 $('conditions-summary').textContent=conditionsText();
 const any=FIELDS.some(k=>$(k).value.trim());
 if(any){try{conditionsFromStrings(Object.fromEntries(FIELDS.map(k=>[k,$(k).value])));$('conditions-error').textContent='';}catch(e){$('conditions-error').textContent=e.message;}}
 else $('conditions-error').textContent='';
 analysis?.syncInput();
}
function renderSequence(){
 const view=$('sequence-view'),scroll=view.scrollTop;
 view.replaceChildren();
 const hasSequence=parsed.ok&&Boolean(parsed.seq);
 view.classList.toggle('is-empty',!hasSequence);
 if(!hasSequence){view.textContent='서열을 입력하면 전체 서열과 선택 경계를 표시합니다.';return;}
 const style=getComputedStyle(view),fontSize=parseFloat(style.fontSize);
 if(measureContext)measureContext.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
 const unit=(measureContext?measureContext.measureText('A').width:fontSize*.65)+(parseFloat(style.letterSpacing)||0);
 const available=view.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-parseFloat(style.getPropertyValue('--sequence-coordinate-width'))-parseFloat(style.getPropertyValue('--sequence-gap'));
 const n=Math.max(10,Math.min(80,Math.floor((available+unit)/(11*unit))*10));
 const frag=document.createDocumentFragment();
 for(let offset=0;offset<parsed.seq.length;offset+=n){
  const row=document.createElement('div'),coord=document.createElement('span'),text=document.createElement('span');row.className='seq-row';coord.className='seq-coordinate';text.className='seq-text';coord.textContent=String(offset+1);
  for(let block=offset;block<Math.min(offset+n,parsed.seq.length);block+=10){
   const end=Math.min(block+10,offset+n,parsed.seq.length),lo=Math.max(block,range.start-1),hi=Math.min(end,range.end);
   if(block>offset)text.append(' ');
   if(lo<hi){text.append(parsed.seq.slice(block,lo));const mark=document.createElement('mark');mark.textContent=parsed.seq.slice(lo,hi);text.append(mark,parsed.seq.slice(hi,end));}else text.append(parsed.seq.slice(block,end));
  }
  row.append(coord,text);frag.append(row);
 }
 view.append(frag);view.scrollTop=scroll;
}
function render(){
 const ok=parsed.ok&&Boolean(parsed.seq),locked=$('lock').checked;
 $('input-error').textContent=parsed.ok?'':parsed.error;
 $('input-status').textContent=parsed.ok?(parsed.seq?`정규화 ${parsed.seq.length.toLocaleString()} nt · 공백 ${parsed.white}자 제거 · 소문자 ${parsed.lower}자 대문자화 · 행 앞 번호 ${parsed.numbered}개 제거${selectionNotice}`:'입력한 서열은 자동 저장하거나 외부로 전송하지 않습니다.'):'';
 $('total').textContent=`총 ${ok?parsed.seq.length.toLocaleString():0} nt`;
 for(const id of ['start-handle','end-handle','start','end','lock','left','right'])$(id).disabled=!ok;
 for(const id of ['start','end'])$(id).max=String(ok?parsed.seq.length:1);
 $('end').readOnly=locked;
 for(const node of document.querySelectorAll('[data-edge]'))node.disabled=!ok||locked;
 for(const id of ['start-handle','end-handle']){$(id).max=String(ok?parsed.seq.length:1);$(id).value=ok?range[id.startsWith('start')?'start':'end']:1;}
 if(!coordinateDraft){$('start').value=ok?range.start:'';$('end').value=ok?range.end:'';}
 $('start-label').textContent=ok?range.start:'';$('end-label').textContent=ok?range.end:'';$('length').textContent=`${ok?range.length:0} nt`;
 $('left').disabled=!ok||range.start===1;$('right').disabled=!ok||range.end===parsed.seq.length;
 const pair=ok?strands(parsed.seq,range):null;
 $('strand-a').textContent=pair?.a||'—';$('strand-b').textContent=pair?.b||'—';
 $('relationship').textContent=ok?`원본 ${$('source-name').value.trim()||parsed.name||'이름 없음'} · 총 ${parsed.seq.length} nt 중 ${range.start}–${range.end} (양끝 포함) → 독립 oligo 1–${range.length}. 선택 밖 서열의 folding은 계산하지 않습니다.`:'서열 입력 후 원본 좌표를 표시합니다.';
 for(const id of ['copy-a','copy-b','copy-selection','save-selection'])$(id).disabled=!valid();
 renderSequence();
 analysis?.syncInput();
}
function commit(edge,value){
 if(!parsed.ok||!parsed.seq)return;
 const n=parsed.seq.length,desired=Number(value);
 if(!String(value).trim()||!Number.isInteger(desired)||desired<1||desired>n){coordinateDraft=true;$('selection-error').textContent='좌표에 전체 서열 범위 안의 정수를 입력하세요.';for(const id of ['copy-a','copy-b','copy-selection','save-selection'])$(id).disabled=true;analysis?.syncInput();return;}
 try{
  range=$('lock').checked?moveRange(n,range,desired-range[edge]):selection(n,edge==='start'?desired:range.start,edge==='end'?desired:range.end);
  coordinateDraft=false;$('selection-error').textContent='';$('copy-status').textContent='';render();
 }catch(e){coordinateDraft=true;$('selection-error').textContent=e.message;for(const id of ['copy-a','copy-b','copy-selection','save-selection'])$(id).disabled=true;analysis?.syncInput();}
}
function snapshotText(){
 if(!valid())throw new Error('유효한 서열과 선택 좌표가 필요합니다.');
 const pair=strands(parsed.seq,range),lines=['JSU LabTools · Oligo 선택 정보','도구: 0.1.0-beta.1','상태: 선택 정보 기록 (계산 결과와 별도)',`원본 이름: ${$('source-name').value.trim()||parsed.name||'이름 없음'}`,`원본 정규화 길이: ${parsed.seq.length} nt`,`선택 좌표: ${range.start}–${range.end} (1-based inclusive)`,`독립 oligo 길이: ${range.length} nt`,`선택 이름/역할: ${$('role').value.trim()||'미지정'}`,`A (5′→3′): ${pair.a}`,`B 완전 상보 (5′→3′): ${pair.b}`,'현재 입력 조건 (계산 결과는 별도 결과 출력 사용):'];
 const units={temperature:'°C',na:'mM',k:'mM',nh4:'mM',mg:'mM total',dntp:'mM total',a:'nM',b:'nM'};
 for(const k of FIELDS)lines.push(`${labels[k]}: ${$(k).value.trim()||'미입력'} ${units[k]}`);
 try{const c=conditionsFromStrings(Object.fromEntries(FIELDS.map(k=>[k,$(k).value])));lines.push(`절대온도: ${c.temperatureK} K`);}catch(e){lines.push(`조건 미확정: ${e.message}`);}
 lines.push(`반응 메모 (효과 미반영): ${$('memo').value.trim()||'없음'}`,'선택 영역을 독립 oligo로 취급. 부모 전체 folding·속도/효율·형광 예측 없음.');
 return lines.join('\n');
}
async function copy(text){try{await navigator.clipboard.writeText(text);$('copy-status').textContent='복사했습니다.';}catch{$('copy-status').textContent='클립보드 접근이 허용되지 않았습니다. 선택 정보 TXT로 저장할 수 있습니다.';}}
$('raw').addEventListener('input',()=>{
 parsed=normalize($('raw').value);coordinateDraft=false;selectionNotice='';$('selection-error').textContent='';$('copy-status').textContent='';
 if(parsed.ok&&parsed.seq.length){const n=parsed.seq.length,prior=range;range=range?selection(n,Math.min(range.start,n),Math.min(Math.max(range.end,range.start),n)):selection(n,1,Math.min(20,n));if(prior&&(prior.start!==range.start||prior.end!==range.end))selectionNotice=' · 선택 좌표를 새 원본 범위로 조정했습니다.';}else range=null;
 render();
});
for(const edge of ['start','end']){
 $(edge+'-handle').addEventListener('input',()=>{let value=Number($(edge+'-handle').value);if(!$('lock').checked)value=edge==='start'?Math.min(value,range.end):Math.max(value,range.start);commit(edge,value);});
 $(edge).addEventListener('input',()=>commit(edge,$(edge).value));
 $(edge).addEventListener('change',()=>commit(edge,$(edge).value));
 $(edge).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commit(edge,$(edge).value);}});
}
for(const button of document.querySelectorAll('[data-edge]'))button.addEventListener('click',()=>{const edge=button.dataset.edge,n=parsed.seq.length,v=Math.max(edge==='start'?1:range.start,Math.min(edge==='start'?range.end:n,range[edge]+Number(button.dataset.step)));commit(edge,v);});
for(const [id,delta] of [['left',-1],['right',1]])$(id).addEventListener('click',()=>{if(!parsed.ok||!range)return;range=moveRange(parsed.seq.length,range,delta);coordinateDraft=false;$('selection-error').textContent='';render();});
$('lock').addEventListener('change',()=>{coordinateDraft=false;$('selection-error').textContent='';render();});
$('source-name').addEventListener('input',render);
for(const k of FIELDS)$(k).addEventListener('input',showConditions);
$('copy-a').addEventListener('click',()=>{if(valid())copy(strands(parsed.seq,range).a);});$('copy-b').addEventListener('click',()=>{if(valid())copy(strands(parsed.seq,range).b);});
$('copy-selection').addEventListener('click',()=>{if(valid())copy(snapshotText());});
$('save-selection').addEventListener('click',()=>{if(!valid())return;const blob=new Blob([snapshotText()],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='oligo-selection.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('copy-status').textContent='선택 정보 TXT를 저장했습니다.';});
$('clear').addEventListener('click',()=>{analysis?.reset();for(const id of ['raw','source-name','role','memo'])$(id).value='';restoreDefaultConditions();$('lock').checked=false;parsed=normalize('');range=null;coordinateDraft=false;selectionNotice='';$('selection-error').textContent='';$('copy-status').textContent='';showConditions();render();$('raw').focus();});
new ResizeObserver(entries=>{const width=Math.floor(entries[0].contentRect.width);if(Math.abs(width-lastWidth)>5){lastWidth=width;renderSequence();}}).observe($('sequence-view'));
restoreDefaultConditions();showConditions();render();

analysis=initAnalysis({readInput:()=>({raw:$('raw').value,parentName:$('source-name').value,role:$('role').value,memo:$('memo').value,parsed,range,coordinateDraft,conditions:Object.fromEntries(FIELDS.map(k=>[k,$(k).value]))})});
