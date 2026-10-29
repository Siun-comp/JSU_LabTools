// SPDX-License-Identifier: GPL-2.0-or-later
import {normalize,reverseComplement,selection,moveRange} from './sequence.mjs';
const $=id=>document.getElementById('beacon-'+id);
export function initBeaconInput({readRecognition,onChange}){
 let parsed=normalize(''),range=null,coordinateDraft=false,origin='user-entered',generated=null,notice='',width=0;
 const dna=s=>s.replace(/\s/g,'').toUpperCase();
 function read(){return {stem5Raw:$('s5').value,stem3Raw:$('s3').value,stem3Mode:$('stem-mode').value,apiRaw:$('api').value,siteMode:$('site-mode').value,siteStartRaw:$('site-start').value,siteEndRaw:$('site-end').value,target:{raw:$('target').value,parsed,range,coordinateDraft,name:$('target-name').value,origin,generatedFromRecognition:generated}};}
 function active(edge){$('track').classList.toggle('active-start',edge==='start');for(const x of ['start','end'])$('active-'+x).setAttribute('aria-pressed',String(edge===x));}
 function selectedR(){const i=readRecognition();return i.parsed.ok&&i.range&&!i.coordinateDraft?i.parsed.seq.slice(i.range.start-1,i.range.end):'';}
 function viewSequence(){
  const view=$('sequence'),scroll=view.scrollTop;view.replaceChildren();if(!parsed.ok||!parsed.seq){view.textContent='Target 원본을 입력한 뒤 두 경계를 선택하세요.';return;}
  const css=getComputedStyle(view),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font=`${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
  const unit=ctx.measureText('A').width+(parseFloat(css.letterSpacing)||0),n=Math.max(10,Math.min(80,Math.floor((view.clientWidth-78)/(11*unit))*10));
  const frag=document.createDocumentFragment();for(let offset=0;offset<parsed.seq.length;offset+=n){const row=document.createElement('div'),coord=document.createElement('span'),text=document.createElement('span');row.className='seq-row';coord.className='seq-coordinate';coord.textContent=offset+1;text.className='seq-text';
   for(let b=offset;b<Math.min(offset+n,parsed.seq.length);b+=10){if(b>offset)text.append(' ');const z=Math.min(b+10,offset+n,parsed.seq.length),lo=Math.max(b,(range?.start||1)-1),hi=Math.min(z,range?.end||0);if(lo<hi){text.append(parsed.seq.slice(b,lo));const m=document.createElement('mark');m.textContent=parsed.seq.slice(lo,hi);text.append(m,parsed.seq.slice(hi,z));}else text.append(parsed.seq.slice(b,z));}row.append(coord,text);frag.append(row);
  }view.append(frag);view.scrollTop=scroll;
 }
 function render(){
  const r=selectedR(),s5=dna($('s5').value),manual=$('stem-mode').value==='manual',s3=manual?dna($('s3').value):/^[ACGT]+$/.test(s5)?reverseComplement(s5):'';
  $('s3').disabled=!manual;$('linked').textContent=manual?'수동 S3 초안 사용':`연동 S3 5′→3′: ${s3||'S5 입력 필요'}`;
  const valid=/^[ACGT]+$/.test(s5)&&/^[ACGT]+$/.test(s3)&&r.length>=3;
  $('assembled').textContent=valid?s5+r+s3:'S5 · 인식 영역 R · S3를 입력하세요.';$('assembled').classList.toggle('is-empty',!valid);
  $('assembly-context').textContent=valid?`전체 ${s5.length+r.length+s3.length} nt · S5 1–${s5.length} / R ${s5.length+1}–${s5.length+r.length} / S3 ${s5.length+r.length+1}–${s5.length+r.length+s3.length}${s5.length+r.length+s3.length>60?' · 전체60nt 초과: 전체 Beacon 분석 미지원':''}`:'기존 선택 영역을 R로 사용합니다. R은 최소3nt이며 추가 stem에는 부모R 좌표가 없습니다.';
  $('copy-assembled').disabled=!valid;
  const ok=parsed.ok&&!!parsed.seq,n=ok?parsed.seq.length:1;
  $('target-status').textContent=!parsed.ok?parsed.error:ok?`원본 ${n} nt · 선택 ${range?.start}–${range?.end} (${range?.length} nt)${range?.length>60?' · 선택60nt 초과':''}${notice}`:'Target 미입력 · 가능한 Beacon hairpin만 계산합니다.';
  $('target').setAttribute('aria-invalid',String(!parsed.ok));
  $('origin').textContent=`출처: ${origin==='user-entered'?'사용자 입력':origin==='generated-from-recognition'?'R 역상보로 만든 예시 초안':'R 역상보 초안을 사용자 편집'}${generated&&generated!==r?' · 생성 당시R과 현재R이 다릅니다. 자동 교체하지 않습니다.':''}`;
  for(const edge of ['start','end']){for(const suffix of ['', '-handle']){const node=$(edge+suffix);node.disabled=!ok;node.max=n;node.setAttribute('aria-invalid',String(coordinateDraft));if(suffix)node.value=range?.[edge]||1;else if(!coordinateDraft)node.value=range?.[edge]||'';}
   $(edge+'-handle').setAttribute('aria-valuetext',ok?`Target ${edge==='start'?'시작':'끝'} ${range?.[edge]}, ${range?.length} nt`:'Target 입력 필요');$('active-'+edge).disabled=!ok;
  }
  $('end').readOnly=$('lock').checked;for(const b of document.querySelectorAll('[data-target-edge]'))b.disabled=!ok||$('lock').checked;
  $('lock').disabled=!ok;$('left').disabled=!ok||range?.start<=1;$('right').disabled=!ok||range?.end>=n;
  $('site-start').disabled=$('site-end').disabled=$('site-mode').value!=='explicit';viewSequence();
 }
 function changed(){render();onChange();}
 function commit(edge,value){if(!parsed.ok||!range)return;try{const v=Number(value);if(!String(value).trim()||!Number.isInteger(v)||v<1||v>parsed.seq.length)throw Error('Target 좌표에 원본 범위 안의 정수를 입력하세요.');range=$('lock').checked?moveRange(parsed.seq.length,range,v-range[edge]):selection(parsed.seq.length,edge==='start'?v:coordinateDraft?Number($('start').value):range.start,edge==='end'?v:coordinateDraft?Number($('end').value):range.end);coordinateDraft=false;notice='';$('range-error').textContent='';}catch(e){coordinateDraft=true;$('range-error').textContent=e.message;}changed();}
 function parseTarget(){const previous=range;parsed=normalize($('target').value);notice='';if(parsed.ok&&parsed.seq){if(!previous){range=selection(parsed.seq.length,1,parsed.seq.length);coordinateDraft=false;}else if(previous.end>parsed.seq.length){coordinateDraft=true;notice=' · 원본이 짧아졌습니다. 두 좌표를 다시 확정하세요.';}else{range=previous;coordinateDraft=false;}}else{range=null;coordinateDraft=false;}changed();}
 $('target').addEventListener('input',()=>{if(generated)origin='edited-generated';parseTarget();});
 $('generate-target').addEventListener('click',()=>{const r=selectedR();if(!/^[ACGT]{3,60}$/.test(r)){$('range-error').textContent='먼저 유효한 R3~60nt를 선택하세요.';return;}generated=r;origin='generated-from-recognition';$('target').value=reverseComplement(r);range=null;parseTarget();$('target').focus();});
 $('copy-stem3').addEventListener('click',()=>{const s=dna($('s5').value);if(!/^[ACGT]+$/.test(s)){$('range-error').textContent='S5에 A/C/G/T를 입력하세요.';return;}$('s3').value=reverseComplement(s);$('stem-mode').value='manual';changed();});
 $('copy-assembled').addEventListener('click',()=>navigator.clipboard.writeText($('assembled').textContent).then(()=>$('copy-status').textContent='조립 서열을 복사했습니다.').catch(()=>$('copy-status').textContent='복사 실패 · 결과 TXT를 사용하세요.'));
 for(const edge of ['start','end']){for(const kind of ['', '-handle']){$(edge+kind).addEventListener('focus',()=>active(edge));$(edge+kind).addEventListener('input',()=>{let v=$(edge+kind).value;if(kind&&!$('lock').checked)v=edge==='start'?Math.min(Number(v),range.end):Math.max(Number(v),range.start);commit(edge,v);});}
  $('active-'+edge).addEventListener('click',()=>{active(edge);$(edge+'-handle').focus();});
 }
 for(const b of document.querySelectorAll('[data-target-edge]'))b.addEventListener('click',()=>{const edge=b.dataset.targetEdge;commit(edge,range[edge]+Number(b.dataset.step));});
 for(const [id,delta] of [['left',-1],['right',1]])$(id).addEventListener('click',()=>{range=moveRange(parsed.seq.length,range,delta);coordinateDraft=false;$('range-error').textContent='';changed();});
 $('lock').addEventListener('change',changed);
 for(const id of ['s5','s3','stem-mode','api','target-name','site-mode','site-start','site-end'])$(id).addEventListener('input',changed);
 const observer=new ResizeObserver(entries=>{const w=entries[0]?.contentRect.width;if(w&&w!==width){width=w;viewSequence();}});observer.observe($('sequence'));
 function reset(){parsed=normalize('');range=null;coordinateDraft=false;origin='user-entered';generated=null;notice='';for(const id of ['s5','s3','target','target-name','site-start','site-end'])$(id).value='';$('stem-mode').value='linked';$('site-mode').value='auto';$('api').value='200';$('lock').checked=false;$('range-error').textContent='';$('copy-status').textContent='';render();}
 function focusError(reason=''){const target=/API/.test(reason)?'api':/site/.test(reason)?'site-start':/Target/.test(reason)?coordinateDraft?'start':'target':/3′ stem/.test(reason)?'s3':!parsed.ok?'target':coordinateDraft?'start':'s5';$(target).closest('details')?.setAttribute('open','');$(target).focus();}
 render();return {read,render,reset,focusError};
}
