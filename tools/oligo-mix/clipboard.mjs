import {format as f,VERSION as ALGORITHM_VERSION} from './core.mjs';
export const TOOL_VERSION='1.1.0';
export const COMPONENT_TYPES=['F','R','P','Q','Plasmid'];
export function nextComponentName(type,counters,names=[]){
 if(!COMPONENT_TYPES.includes(type))throw Error('지원하지 않는 성분 종류입니다.');
 let n=(counters[type]||0)+1;while(names.includes(type+n))n++;
 return {name:type+n,count:n};
}
export function safeText(value){const s=String(value).replace(/[\t\r\n]/g,' ');return /^\s*[=+\-@]/.test(s)?"'"+s:s;}
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// A: No, B:C: Reagent, D:E: batch, F:G: target, H:I: stock, J:K: per reaction.
// Plain text retains the empty C column so values land in the same columns as HTML.
export function excelClipboard(result){
 const conversionNotes=result.rows.filter(r=>r.conversionNote).map(r=>safeText(r.name)+': '+r.conversionNote).join('; ');
 const rows=Array.from({length:result.rows.length+4},()=>Array(11).fill(''));
 rows[0]=['Final Volume','','',f(result.reaction),'µL',`Oligo Mix 이론값 · 도구 ${TOOL_VERSION} / 알고리즘 ${ALGORITHM_VERSION}${conversionNotes?' · '+conversionNotes:''}`,'','','','',''];
 rows[1]=['No','Reagent','',String(result.count),'rxns','Final conc / amount','','stock conc','','1 rxn',''];
 rows[2]=['','TE pH8.0','',f(result.batchTE),'µL','-','','-','',f(result.te),'µL'];
 result.rows.forEach((r,i)=>{rows[i+3]=[String(r.sourceIndex??i+1),safeText(r.name),'',f(r.batch),'µL',f(r.target),r.targetUnit,f(r.stock),r.stockUnit,f(r.perReaction),'µL'];});
 const last=rows.length-1;
 rows[last]=['Total','','',f(result.total),'µL','Mix / rxn','','','',f(result.mix),'µL'];
 const merges=new Map([['0,0',3],['0,5',6],['1,5',2],['1,7',2],['1,9',2],['2,5',2],['2,7',2],[`${last},0`,3],[`${last},5`,4]]);
 for(let y=1;y<last;y++)merges.set(`${y},1`,2);
 const font="font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:9pt;";
 const widths=[36,96,96,104,42,104,76,104,76,104,42];
 const htmlRows=rows.map((row,y)=>{let cells='';for(let x=0;x<11;){
  const span=merges.get(`${y},${x}`)||1,value=row[x];
  const numeric=value!==''&&/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value),format=numeric?'General':'\\@';
  const header=y<2,total=y===last,highlight=x===3||(total&&x===9);
  const background=highlight?'#fff2cc':header&&x!==4?'#17365d':total?'#e8eef6':y===2?'#f2f5f9':'#ffffff';
  const color=header&&!highlight&&x!==4?'#ffffff':'#111111';
  const align=numeric?'right':x===1||(y===0&&x===5)?'left':'center';
  const width=widths.slice(x,x+span).reduce((a,b)=>a+b,0);
  const style=`${font}mso-number-format:'${format}';background-color:${background};color:${color};border:1px solid #b8c4d0;${total?'border-top:2px solid #17365d;':''}font-weight:${header||total?'bold':'normal'};text-align:${align};vertical-align:middle;white-space:normal;word-wrap:break-word;overflow-wrap:anywhere;padding:4px 6px;width:${width}px;`;
  cells+=`<td${span>1?` colspan="${span}"`:''} width="${width}" bgcolor="${background}" style="${style}">${escapeHTML(value)}</td>`;x+=span;
 }return `<tr style="height:24px;">${cells}</tr>`;}).join('');
 const columns=widths.map(width=>`<col width="${width}" style="width:${width}px;">`).join('');
 const html=`<!doctype html><html lang="ko" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body style="background-color:#ffffff;color:#111111;"><!--StartFragment--><table style="${font}border-collapse:collapse;table-layout:fixed;width:${widths.reduce((a,b)=>a+b,0)}px;background-color:#ffffff;color:#111111;"><colgroup>${columns}</colgroup>${htmlRows}</table><!--EndFragment--></body></html>`;
 const text=rows.map(row=>row.join('\t')).join('\r\n');
 return {html,text,rows};
}
