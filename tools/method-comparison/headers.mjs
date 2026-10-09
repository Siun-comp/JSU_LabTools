const key=v=>String(v??'').trim().toLowerCase().replace(/[\s_\-()（）/·]/g,'');
const aliases=[
 ['검체id','검체번호','sampleid','specimenid','id'],
 ['채취일','검체채취일','수집일','검체수집일','날짜','collectiondate','sampledate','date'],
 ['reference결과','referenceresult','reference판정','ref결과','refresult','reference'],
 ['reference검출값','reference값','referencevalue','referencect','referencett','referencecttt','reference검출값cttt','refvalue','refct','ct','검출값'],
 ['product결과','productresult','product판정','product'],
 ['product검출값','product값','productvalue','productct','producttt','productcttt','product검출값cttt','tt','ct','검출값']
].map(a=>new Set(a));
export function isHeader(cells){const match=aliases.map((set,i)=>set.has(key(cells[i])));return match[0]&&match[2]&&match[4]&&match.filter(Boolean).length>=4;}
// Only the supplied workbook's recognizable text-only introduction can precede
// a header. A malformed or valid specimen row before it is never discarded.
function introduction(records){return records.length>0&&key(records[0].cells[0])==='데이터입력'&&records.every(r=>r.cells.slice(1).every(v=>!String(v??'').trim())&&/^(데이터\s*입력|사용자는\s*A|A[–-]F만|2_상관_회귀는)/.test(String(r.cells[0]).trim()));}
export function extractInput(records){
  const nonempty=records.filter(r=>r.cells.some(v=>String(v??'').trim())),first=nonempty[0];
  let header=first&&isHeader(first.cells)?first:null;
  if(!header&&first){const index=nonempty.findIndex(r=>isHeader(r.cells));if(index>0&&introduction(nonempty.slice(0,index)))header=nonempty[index];}
  const data=header?records.filter(r=>r.sourceRow>header.sourceRow):records;
  const startRow=header?header.sourceRow+1:first?.sourceRow??1;
  const info={present:Boolean(header),headerRow:header?.sourceRow??null,startRow,
    description:header?`헤더 인식: ${header.sourceRow}행 · 데이터 ${startRow}행부터`:first?`헤더 없음 · 데이터 ${startRow}행부터`:'입력 데이터 없음'};
  return {records:data,header:info};
}
