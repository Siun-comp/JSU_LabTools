import {format as f,VERSION as ALGORITHM_VERSION} from './core.mjs';
export const TOOL_VERSION='1.0.0';
export const COMPONENT_TYPES=['F','R','P','Q','Plasmid'];
export function nextComponentName(type,counters,names=[]){
 if(!COMPONENT_TYPES.includes(type))throw Error('지원하지 않는 성분 종류입니다.');
 let n=(counters[type]||0)+1;while(names.includes(type+n))n++;
 return {name:type+n,count:n};
}
export function safeText(value){const s=String(value).replace(/[\t\r\n]/g,' ');return /^\s*[=+\-@]/.test(s)?"'"+s:s;}
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Reference columns with dynamic component rows. No formulas, raw data, clipboard reads or file generation.
export function excelClipboard(result){
 const conversionNotes=result.rows.filter(r=>r.conversionNote).map(r=>safeText(r.name)+': '+r.conversionNote).join('; ');
 const rows=Array.from({length:result.rows.length+4},()=>Array(10).fill(''));
 rows[0]=['Final Volume','',f(result.reaction),'µL',`Oligo Mix 이론값 · 도구 ${TOOL_VERSION} / 알고리즘 ${ALGORITHM_VERSION}${conversionNotes?' · '+conversionNotes:''}`,'','','','',''];
 rows[1]=['No','Reagent',String(result.count),'rxns','Final conc / amount','','stock conc','','1 rxn',''];
 rows[2]=['','TE pH8.0',f(result.batchTE),'µL','-','','-','',f(result.te),'µL'];
 result.rows.forEach((r,i)=>{rows[i+3]=[String(r.sourceIndex??i+1),safeText(r.name),f(r.batch),'µL',f(r.target),r.targetUnit,f(r.stock),r.stockUnit,f(r.perReaction),'µL'];});
 const last=rows.length-1;
 rows[last]=['Total','',f(result.total),'µL','Mix / rxn','','','',f(result.mix),'µL'];
 const merges=new Map([['0,0',2],['0,4',6],['1,4',2],['1,6',2],['1,8',2],['2,4',2],['2,6',2],[`${last},0`,2],[`${last},4`,4]]);
 const font="font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:9pt;";
 const htmlRows=rows.map((row,y)=>{let cells='';for(let x=0;x<10;){const span=merges.get(`${y},${x}`)||1,value=row[x];const numeric=value!==''&&/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value);const format=numeric?'General':'\\@';cells+=`<td${span>1?` colspan="${span}"`:''} style="${font}mso-number-format:'${format}';border:none;vertical-align:middle;white-space:normal;">${escapeHTML(value)}</td>`;x+=span;}return '<tr>'+cells+'</tr>';}).join('');
 const html=`<!doctype html><html lang="ko" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><!--StartFragment--><table style="${font}border-collapse:collapse;">${htmlRows}</table><!--EndFragment--></body></html>`;
 const text=rows.map(row=>row.join('\t')).join('\r\n');
 return {html,text,rows};
}
