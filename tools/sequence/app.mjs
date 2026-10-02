import {analyze,outputText,position,lengthSummary,VERSION} from './core.mjs';
const $=id=>document.getElementById(id),dialog=$('sequence-dialog');
let upper=false,current;
function options(){return {outputMode:$('sequence-output-mode').value,reverse:$('sequence-reverse').checked,complement:$('sequence-complement').checked,uppercase:upper};}
function preview(result){const fragment=document.createDocumentFragment(),limit=12000;let shown=0;
 for(const part of result.segments){if(shown>=limit)break;const text=result.raw.slice(part.start,Math.min(part.end,part.start+limit-shown));shown+=text.length;const node=document.createElement('span');node.textContent=part.kind==='space'?text.replace(/ /g,'␠').replace(/\t/g,'⇥').replace(/\r\n|\r|\n/g,'↵\n'):text;
  if(['mod','space','hyphen'].includes(part.kind)){node.className='sequence-mark';node.title='삭제';}else if(part.kind==='convert'){node.className='sequence-convert-mark';node.title=result.outputMode==='DNA'?'표기 변경: U→T':'표기 변경: T→U';}else if(part.kind==='error'){node.className='sequence-error-mark';node.title='오류';}else if(part.kind==='header'){node.className='sequence-header';node.title='FASTA 이름: 유지';}fragment.append(node);
 }
 if(result.raw.length>limit){const note=document.createElement('span');note.textContent='\n… 미리보기는 처음 12,000자까지 표시합니다. 출력·복사는 전체 기록을 사용합니다.';fragment.append(note);}
 $('sequence-review').replaceChildren(fragment);
}
function refresh(){
 $('sequence-copy-status').textContent='';$('sequence-output').value='';$('sequence-copy').disabled=true;$('sequence-errors').textContent='';$('sequence-warnings').textContent='';$('sequence-result-note').textContent='';$('sequence-length').textContent='';
 const opt=options();
 const raw=$('sequence-input').value;
 if(!raw){current=undefined;$('sequence-review').replaceChildren();$('sequence-summary').textContent='입력 원문은 그대로 두고 출력만 정리합니다.';return;}
 current=analyze(raw,opt);preview(current);$('sequence-warnings').textContent=current.warnings.join('\n');
 const c=current.counts;$('sequence-summary').textContent=`삭제: 수정 표기 ${c.mods}구간 · 공백/탭/줄바꿈 ${c.spaces}문자 · - ${c.hyphens}개 · ${opt.outputMode==='DNA'?'U→T':'T→U'} ${c.converted}문자${upper?' · 대문자 출력 적용':''}`;
 if(current.errorCount){$('sequence-errors').textContent=current.errors.map(e=>{const p=position(raw,e.start);return `[오류] ${p.line}행 ${p.column}열: ${e.message}`;}).join('\n')+(current.errorCount>20?`\n그 밖의 오류 ${current.errorCount-20}개`:'' );return;}
 try{const isFasta=$('sequence-fasta-on').checked||current.records.length>1;if(isFasta&&!/^\d+$/.test($('sequence-width').value))throw Error('FASTA 줄 길이를 0~200의 정수로 입력하세요.');const text=outputText(current,{fasta:isFasta,name:$('sequence-name').value,width:Number($('sequence-width').value)});$('sequence-output').value=text;$('sequence-copy').disabled=false;$('sequence-copy').textContent=isFasta?'FASTA 복사':'출력 복사';
  $('sequence-length').textContent=lengthSummary(current);
  $('sequence-result-note').textContent=`${current.records.length}기록 · ${current.operation} · ${current.outputMode} ${current.direction}`+(isFasta&&current.direction==='3′→5′'?' · 주의: 이 FASTA 결과는 3′→5′ 표기입니다.':'');
 }catch(error){$('sequence-errors').textContent='[오류] '+error.message;}
}
$('open-sequence').addEventListener('click',()=>{dialog.showModal();$('sequence-input').focus();});
$('sequence-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>$('open-sequence').focus());
for(const id of ['sequence-input','sequence-output-mode','sequence-reverse','sequence-complement','sequence-fasta-on','sequence-name','sequence-width'])$(id).addEventListener(id==='sequence-input'||id==='sequence-name'||id==='sequence-width'?'input':'change',refresh);
$('sequence-upper').addEventListener('click',()=>{upper=true;refresh();});
$('sequence-clear').addEventListener('click',()=>{$('sequence-input').value='';upper=false;refresh();$('sequence-input').focus();});
$('sequence-copy').addEventListener('click',async()=>{const value=$('sequence-output').value;if(!current?.valid||$('sequence-copy').disabled)return;try{await navigator.clipboard.writeText(value);$('sequence-copy-status').textContent=value===$('sequence-output').value?'출력을 복사했습니다.':'복사 후 입력이 변경되었습니다. 다시 복사하세요.';}catch{$('sequence-copy-status').textContent='복사하지 못했습니다. 출력창에서 직접 선택해 복사하세요.';}});
$('sequence-version').textContent='도구·알고리즘 v'+VERSION;refresh();
