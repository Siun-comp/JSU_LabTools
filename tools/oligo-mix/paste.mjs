import {validateOligoNumber} from './core.mjs';
// Only user-pasted text is parsed. No clipboard reads, file uploads or formula evaluation.
export function parseOligoPaste(text,{header=false,type='F'}={}){
 if(!['F','R','P','Q'].includes(type))throw Error('붙여넣기는 F/R/P/Q의 µM 입력만 지원합니다.');
 if(text.length>2*1024*1024)throw Error('붙여넣기 표는 2Mi 문자 이내로 나누어 입력하세요. 일부 행을 자동으로 잘라내지 않습니다.');
 const lines=text.replace(/\r\n?/g,'\n').split('\n');if(header)lines.shift();
 const rows=[];let blank=0,defaults=0;
 for(const [i,line] of lines.entries()){
  if(!line.trim()){blank++;continue;}
  const rowNumber=i+1+(header?1:0);
  const cells=line.split('\t').map(s=>s.trim());
  if(cells.length!==3)throw Error(`${rowNumber}행: 이름 / 최종 농도 / Stock 농도 3열을 붙여넣으세요.`);
  const [name,target,rawStock]=cells,stock=rawStock||'100';
  if(!name||name.length>100)throw Error(`${rowNumber}행: 이름은 1~100자여야 합니다.`);
  validateOligoNumber(target,`${rowNumber}행 최종 농도`);validateOligoNumber(stock,`${rowNumber}행 Stock 농도`);
  if(!rawStock)defaults++;
  rows.push({enabled:true,type,name,target,stock,defaultStock:!rawStock});
 }
 if(!rows.length)throw Error('붙여넣을 성분이 없습니다.');
 const seen=new Set(),duplicates=[];for(const r of rows){if(seen.has(r.name))duplicates.push(r.name);seen.add(r.name);}
 return {rows,blank,defaults,duplicates};
}
