// SPDX-License-Identifier: GPL-2.0-or-later
// Reference annotations (CDS, gene, mRNA) from the reference GenBank and from GFF3/CSV files. They are drawn under the
// reference in the alignment view and in the single-sequence view, and switched by type from the "Annotation" item of
// the summary line (AP-275). Imported ones belong to this reference only and are saved with the project.
import {parseFeatures,shownTypes,ANNOTATION_TYPES,annotationSequence,annotationLength} from './core/features.mjs';
import {readAnnotationFile} from './core/annotation-import.mjs';
const $=id=>document.getElementById(id);
const el=(tag,props={},...kids)=>{const e=Object.assign(document.createElement(tag),props);e.append(...kids);return e;};
const short=s=>s.length>60?s.slice(0,60)+'…':s;

export function setupAnnotations(host){
 const A={gb:[],imported:[],hidden:new Set(),skipped:0,files:0,length:0,refId:''},pop=$('annotation-pop');
 const all=()=>[...A.gb,...A.imported],visible=()=>all().filter(f=>!A.hidden.has(f.type));
 const countOf=type=>all().filter(f=>f.type===type).length;
 function push(){for(const v of host.views())v.setAnnotations(visible());renderStat();renderPop();renderTab();host.changed?.();}
 // Annotation tab: the shown annotations as a table. A name goes to it; "서열 복사" copies its own sequence (AP-277).
 const T={key:'start',dir:1},first=f=>Math.min(...f.ranges.map(r=>r.start));
 const KEYS={type:f=>f.type,label:f=>f.label.toLowerCase(),product:f=>(f.product||'').toLowerCase(),start:first,strand:f=>f.strand,length:f=>annotationLength(f),source:f=>f.source??''};
 const where=f=>f.ranges.map(r=>`${(r.start+1).toLocaleString()}–${r.end.toLocaleString()}`).join(', '),dirText=f=>f.strand<0?'−':f.strand>0?'+':'±',sourceText=f=>f.source??'Reference GenBank';
 function sorted(){const k=KEYS[T.key];return visible().map(f=>[k(f),f]).sort((a,b)=>((a[0]<b[0]?-1:a[0]>b[0]?1:0)||first(a[1])-first(b[1]))*T.dir).map(x=>x[1]);}
 function renderTab(){
  const n=all().length,shown=visible().length,off=n-shown;$('annotation-count').textContent=n?`(${shown.toLocaleString()})`:'';$('annotation-empty').hidden=n>0;$('annotation-table').hidden=!n;
  $('annotation-tab-state').textContent=off?`꺼 둔 종류의 ${off.toLocaleString()}개는 목록에서도 빠집니다.`:'';
  $('annotation-rows').replaceChildren(...sorted().map(f=>el('tr',{},el('td',{},f.type),el('td',{},el('button',{type:'button',className:'link',textContent:f.label,title:'정렬 화면에서 이 위치로 이동하고 첫 조각을 선택합니다',onclick(){host.select(f);}})),el('td',{},f.product||'–'),el('td',{className:'num'},where(f)),el('td',{className:'dir'},dirText(f)),el('td',{className:'num'},annotationLength(f).toLocaleString()),el('td',{},sourceText(f)),el('td',{className:'actions'},el('button',{type:'button',textContent:'서열 복사',title:'조각을 읽는 순서대로 이어 붙인 Reference 서열(5′→3′)을 FASTA로 복사합니다. Consensus가 아니라 Reference 기준입니다.',onclick(){copySeq(f);}})))));
  for(const th of document.querySelectorAll('#annotation-table th[data-key]'))th.setAttribute('aria-sort',th.dataset.key===T.key?(T.dir>0?'ascending':'descending'):'none');
 }
 async function copySeq(f){const s=annotationSequence(f,host.reference()),text=`>${f.label.replace(/\s+/g,'_')} ${f.type} ${f.ranges.map(r=>`${r.start+1}..${r.end}`).join(',')} ${dirText(f)} (${host.refId()})\n${s.match(/.{1,70}/g)?.join('\n')??''}\n`;
  try{await navigator.clipboard.writeText(text);$('annotation-tab-state').textContent=`${f.type} ${f.label} 서열 ${s.length.toLocaleString()} nt를 복사했습니다.`;}catch{$('annotation-tab-state').textContent='복사에 실패했습니다.';}}
 const safe=v=>/^[=+\-@]/.test(String(v))?"'"+v:String(v);
 $('annotation-copy-table').addEventListener('click',async()=>{const head=['Type','Name','Product','Location','Strand','Length_nt','Source'],rows=sorted().map(f=>[f.type,f.label,f.product||'',where(f),dirText(f),annotationLength(f),sourceText(f)].map(safe));
  try{await navigator.clipboard.writeText([head,...rows].map(r=>r.join('\t')).join('\n'));$('annotation-tab-state').textContent=`표 ${rows.length.toLocaleString()}줄을 복사했습니다.`;}catch{$('annotation-tab-state').textContent='복사에 실패했습니다.';}});
 for(const th of document.querySelectorAll('#annotation-table th[data-key]'))th.addEventListener('click',()=>{if(T.key===th.dataset.key)T.dir=-T.dir;else{T.key=th.dataset.key;T.dir=1;}renderTab();});
 $('annotation-tab-types').addEventListener('click',e=>{anchor=e.currentTarget;if(pop.matches(':popover-open')){pop.hidePopover();return;}pop.showPopover();place();});
 // Summary item: the count of shown types, or "없음"; a click opens the small window.
 let item=null,anchor=null;
 function statItem(){item=el('button',{type:'button',className:'stat stat-button',id:'annotation-stat',title:'Reference annotation 표시 선택과 파일 추가'});item.addEventListener('click',()=>{anchor=item;if(pop.matches(':popover-open')){pop.hidePopover();return;}pop.showPopover();place();});renderStat();return item;}
 function renderStat(){if(!item)return;const n=all().length,on=visible().length;item.replaceChildren('Annotation',el('b',{},n?(on===n?n.toLocaleString():`${on.toLocaleString()} / ${n.toLocaleString()}`):'없음'));}
 function place(){const at=anchor??item;if(!at)return;const r=at.getBoundingClientRect(),w=pop.offsetWidth;pop.style.top=`${Math.round(r.bottom+4)}px`;pop.style.left=`${Math.round(Math.max(8,Math.min(r.left,innerWidth-w-8)))}px`;}
 function renderPop(){
  const box=$('annotation-types'),types=ANNOTATION_TYPES.filter(t=>countOf(t));
  box.replaceChildren(...(types.length?types.map(t=>{const c=el('input',{type:'checkbox',checked:!A.hidden.has(t)});c.addEventListener('change',()=>{c.checked?A.hidden.delete(t):A.hidden.add(t);push();});return el('label',{className:'check'},c,` ${t} (${countOf(t).toLocaleString()})`);}):[el('p',{className:'hint',textContent:'표시할 annotation이 없습니다. Reference가 GenBank가 아니면 파일로 추가할 수 있습니다.'})]));
  const parts=[];if(A.gb.length)parts.push(`Reference GenBank ${A.gb.length.toLocaleString()}개`);if(A.imported.length)parts.push(`가져온 파일 ${A.imported.length.toLocaleString()}개`);if(A.skipped)parts.push(`위치를 해석하지 못한 GenBank 항목 ${A.skipped}개는 표시하지 않음(내보내기에는 그대로)`);
  $('annotation-source').textContent=parts.join(' · ');$('annotation-clear').hidden=!A.imported.length;
 }
 $('annotation-add').addEventListener('click',()=>$('annotation-file').click());
 $('annotation-file').addEventListener('change',async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;const note=$('annotation-note');
  let text;try{text=await file.text();}catch(err){note.textContent=`${file.name}: 읽지 못했습니다. ${err.message}`;return;}
  const r=readAnnotationFile(text,{referenceLength:A.length,referenceId:A.refId,source:{id:++A.files,name:file.name}});
  if(r.errors.length){note.textContent=`${file.name}: 넣지 않았습니다.\n${r.errors.join('\n')}`;note.classList.add('bad');return;}
  note.classList.remove('bad');A.imported.push(...r.list.map(f=>({...f,label:short(f.label)})));
  note.textContent=[`${file.name} (${r.format}): ${r.list.length.toLocaleString()}개를 넣었습니다.`,...(r.skipped?[`CDS·gene·mRNA가 아닌 줄 ${r.skipped.toLocaleString()}개는 건너뛰었습니다.`]:[]),...r.notes].join('\n');push();});
 $('annotation-clear').addEventListener('click',()=>{A.imported=[];$('annotation-note').textContent='가져온 annotation을 지웠습니다. GenBank annotation은 그대로입니다.';$('annotation-note').classList.remove('bad');push();});
 addEventListener('resize',()=>{if(pop.matches(':popover-open'))place();});
 return {
  // A new result: GenBank annotations of its reference; imported ones only when a project brings them back.
  open({features,length,refId,saved=null}){const p=parseFeatures(features,length);A.gb=shownTypes(p.list);A.skipped=p.skipped;
   // The same reference mapped again keeps imported annotations and switches; a new reference drops imported ones.
   const same=!saved&&refId===A.refId&&length===A.length,dropped=!saved&&!same?A.imported.length:0;
   if(saved){A.imported=saved.imported??[];A.hidden=new Set(saved.hidden??[]);}else if(!same){A.imported=[];}
   A.length=length;A.refId=refId;A.files=Math.max(A.files,1e3);
   $('annotation-note').textContent=dropped?`Reference가 바뀌어 가져온 annotation ${dropped.toLocaleString()}개를 지웠습니다(이전 Reference 위치였음).`:'';push();},
  statItem,visible,imported:()=>A.imported,
  snapshot:()=>({imported:A.imported,hidden:[...A.hidden]}),
 };
}
