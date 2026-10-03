export const VERSION='0.2.1';
export const MAX_INPUT=1_000_000;
export const MAX_RECORDS=1000;
const maps={DNA:{A:'T',C:'G',G:'C',T:'A',R:'Y',Y:'R',S:'S',W:'W',K:'M',M:'K',B:'V',D:'H',H:'D',V:'B',N:'N'},RNA:{A:'U',C:'G',G:'C',U:'A',R:'Y',Y:'R',S:'S',W:'W',K:'M',M:'K',B:'V',D:'H',H:'D',V:'B',N:'N'}};
function lines(raw){const out=[];let start=0;const re=/\r\n|\n|\r/g;let m;while((m=re.exec(raw))){out.push({start,end:m.index,next:re.lastIndex,text:raw.slice(start,m.index)});start=re.lastIndex;}out.push({start,end:raw.length,next:raw.length,text:raw.slice(start)});return out;}
function changeCase(value,letter){return value===value.toLowerCase()?letter.toLowerCase():letter;}
export function transform(sequence,{outputMode='DNA',reverse=false,complement=false,uppercase=false}={}){
 if(!maps[outputMode])throw Error('출력 종류를 DNA 또는 RNA로 선택하세요.');
 let value='';for(const ch of sequence){let upper=ch.toUpperCase();if(outputMode==='DNA'&&upper==='U')upper='T';else if(outputMode==='RNA'&&upper==='T')upper='U';if(!maps[outputMode][upper])throw Error('미지원 서열 문자입니다.');value+=changeCase(ch,complement?maps[outputMode][upper]:upper);}
 if(reverse)value=[...value].reverse().join('');
 return uppercase?value.toUpperCase():value;
}
export function analyze(raw,options={}){
 if(typeof raw!=='string')throw Error('문자열 입력이 필요합니다.');
 const outputMode=options.outputMode??'DNA';if(!maps[outputMode])throw Error('출력 종류를 DNA 또는 RNA로 선택하세요.');
 const result={version:VERSION,raw,records:[],segments:[],errors:[],errorCount:0,warnings:[],counts:{mods:0,spaces:0,hyphens:0,lowercase:0,converted:0},valid:false};
 const error=(message,start,end=start+1)=>{result.errorCount++;if(result.errors.length<20)result.errors.push({message,start,end});};
 const segment=(kind,start,end)=>{if(end<=start)return;const prev=result.segments.at(-1);if(prev&&prev.kind===kind&&prev.end===start&&kind!=='mod')prev.end=end;else result.segments.push({kind,start,end});};
 if(raw.length>MAX_INPUT){error('입력은 최대 1,000,000자입니다. 잘라내지 않았습니다.',0,raw.length);return result;}
 const inputLines=lines(raw),first=inputLines.find(l=>l.text.trim().length>0);
 if(!first){error('서열을 입력하세요.',0,raw.length);return result;}
 const fasta=first.text.startsWith('>');result.inputFormat=fasta?'FASTA':'일반 서열';
 let records=[];
 if(fasta){let current;for(const line of inputLines){if(line.text.startsWith('>')){if(current)current.end=line.start;current={header:line.text.slice(1),start:line.next,end:raw.length,headerStart:line.start,headerEnd:line.next,index:records.length+1};records.push(current);segment('header',line.start,line.next);if(!current.header.trim()||/^\s/.test(current.header))error('FASTA 이름은 > 바로 뒤에 입력하세요.',line.start,line.end);if(/[\u0000-\u001f\u007f]/.test(current.header))error('이름에 제어 문자를 사용할 수 없습니다.',line.start,line.end);}else if(!current&&line.text.trim())error('첫 FASTA 이름 앞의 내용을 확인하세요.',line.start,line.end);}
 }else records=[{header:null,start:0,end:raw.length,index:1}];
 if(records.length>MAX_RECORDS){error('기록은 최대 1,000개입니다. 합치거나 잘라내지 않았습니다.',0,raw.length);return result;}
 const ids=new Set();
 for(const record of records){let sequence='';if(record.header!==null){const id=record.header.split(/\s/)[0];if(ids.has(id))result.warnings.push('중복 이름: '+id+' (기록 '+record.index+')');ids.add(id);}
  for(let i=record.start;i<record.end;){const ch=raw[i];
   if(ch==='/'){const end=raw.indexOf('/',i+1);if(end<0||end>=record.end){error('닫히지 않은 / 수정 표기입니다.',i);segment('error',i,i+1);i++;continue;}segment('mod',i,end+1);result.counts.mods++;i=end+1;continue;}
   if(/[ \t\r\n]/.test(ch)){segment('space',i,i+1);result.counts.spaces++;i++;continue;}
   if(ch==='-'){segment('hyphen',i,i+1);result.counts.hyphens++;i++;continue;}
   if(/[A-Za-z]/.test(ch)&&(maps.DNA[ch.toUpperCase()]||ch.toUpperCase()==='U')){sequence+=ch;if(ch!==ch.toUpperCase())result.counts.lowercase++;const converted=(outputMode==='DNA'&&/[uU]/.test(ch))||(outputMode==='RNA'&&/[tT]/.test(ch));if(converted)result.counts.converted++;segment(converted?'convert':'base',i,i+1);i++;continue;}
   error('미지원 문자 '+JSON.stringify(ch)+'입니다.',i);segment('error',i,i+1);i++;
  }
  if(!sequence)error('기록 '+record.index+'에 유효한 염기가 없습니다.',record.start,record.end);
  const mixed=/[Tt]/.test(sequence)&&/[Uu]/.test(sequence);if(mixed)result.warnings.push('[혼재 오류·표기 정리] 기록 '+record.index+': T와 U가 함께 있습니다. '+(outputMode==='DNA'?'U→T':'T→U')+'로 정리하며 혼재 자체는 출력을 차단하지 않습니다.');
  result.records.push({...record,sequence,output:transform(sequence,{...options,outputMode}),length:sequence.length});
 }
 result.segments.sort((a,b)=>a.start-b.start);
 result.valid=result.errorCount===0;
 result.outputMode=outputMode;
 result.direction=Boolean(options.reverse)!==Boolean(options.complement)?'3′→5′':'5′→3′';
 result.operation=options.reverse&&options.complement?'Reverse Complement':options.reverse?'Reverse':options.complement?'Complement':'정리 원서열';
 return result;
}
export function position(raw,offset){let line=1,column=1;for(let i=0;i<Math.min(offset,raw.length);i++){if(raw[i]==='\r'){line++;column=1;if(raw[i+1]==='\n')i++;}else if(raw[i]==='\n'){line++;column=1;}else column++;}return {line,column};}
export function outputText(result,{fasta=false,name='sequence_1',width=60}={}){
 if(!result.valid)throw Error('오류를 수정한 뒤 복사하세요.');
 const asFasta=fasta||result.records.length>1;
 if(!asFasta)return result.records[0].output;
 if(!Number.isInteger(width)||width<0||width>200)throw Error('FASTA 줄 길이는 0~200의 정수입니다. 0은 줄바꿈 없음입니다.');
 if(result.records.some(r=>r.header===null)&&(!name||/\s|[<>\u0000-\u001f\u007f]/.test(name)))throw Error('FASTA 이름은 공백 없는 한 줄로 입력하세요.');
 return result.records.map(r=>{const s=r.output;const wrapped=width?s.match(new RegExp('.{1,'+width+'}','g')).join('\n'):s;return '>'+(r.header??name)+'\n'+wrapped;}).join('\n')+'\n';
}

export function lengthSummary(result){
 if(!result.valid)return '';
 const lengths=result.records.map(r=>r.output.length),listed=lengths.slice(0,10).join(' / ')+(lengths.length>10?' / …':''),total=lengths.reduce((a,b)=>a+b,0);
 const count=lengths.length===1?listed+' nt':'기록별 '+listed+' nt · 합계 '+total+' nt';
 return '최종 길이: '+count+(result.outputMode==='DNA'?' (DNA 이중가닥 길이 기준 '+listed+' bp)':'');
}
