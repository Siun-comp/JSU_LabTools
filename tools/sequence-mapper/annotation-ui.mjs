// SPDX-License-Identifier: GPL-2.0-or-later
// Reference annotations (CDS, gene, mRNA) from the reference GenBank and from GFF3/CSV files. They are drawn under the
// reference in the alignment view and in the single-sequence view, and switched by type from the "Annotation" item of
// the summary line (AP-275). Imported ones belong to this reference only and are saved with the project.
import {parseFeatures,shownTypes,ANNOTATION_TYPES} from './core/features.mjs';
import {readAnnotationFile} from './core/annotation-import.mjs';
const $=id=>document.getElementById(id);
const el=(tag,props={},...kids)=>{const e=Object.assign(document.createElement(tag),props);e.append(...kids);return e;};
const short=s=>s.length>60?s.slice(0,60)+'…':s;

export function setupAnnotations(host){
 const A={gb:[],imported:[],hidden:new Set(),skipped:0,files:0,length:0,refId:''},pop=$('annotation-pop');
 const all=()=>[...A.gb,...A.imported],visible=()=>all().filter(f=>!A.hidden.has(f.type));
 const countOf=type=>all().filter(f=>f.type===type).length;
 function push(){for(const v of host.views())v.setAnnotations(visible());renderStat();renderPop();host.changed?.();}
 // Summary item: the count of shown types, or "없음"; a click opens the small window.
 let item=null;
 function statItem(){item=el('button',{type:'button',className:'stat stat-button',id:'annotation-stat',title:'Reference annotation 표시 선택과 파일 추가'});item.addEventListener('click',()=>{if(pop.matches(':popover-open')){pop.hidePopover();return;}pop.showPopover();place();});renderStat();return item;}
 function renderStat(){if(!item)return;const n=all().length,on=visible().length;item.replaceChildren('Annotation',el('b',{},n?(on===n?n.toLocaleString():`${on.toLocaleString()} / ${n.toLocaleString()}`):'없음'));}
 function place(){if(!item)return;const r=item.getBoundingClientRect(),w=pop.offsetWidth;pop.style.top=`${Math.round(r.bottom+4)}px`;pop.style.left=`${Math.round(Math.max(8,Math.min(r.left,innerWidth-w-8)))}px`;}
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
