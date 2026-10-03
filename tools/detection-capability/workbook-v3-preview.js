/* Local read-only preview. No input application, formulas, statistics or raw-record management. */
'use strict';
window.WorkbookV3Preview=(()=>{
 const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',rn='http://schemas.openxmlformats.org/package/2006/relationships';
 const list=(n,k)=>[...n.getElementsByTagNameNS(ns,k)],fail=m=>{throw new Error(m);};
 const used=c=>!!c&&(c.formula||c.value!=='');
 const col=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
 async function read(file){
  const schema=WorkbookTemplateV3;
  if(!/\.xlsx$/i.test(file.name)||file.size>5*1024*1024)fail('공식 .xlsx 파일(5 MiB 이하)을 선택하세요.');
  const bytes=await file.arrayBuffer();let zip;try{zip=await JSZip.loadAsync(bytes);}catch{fail('파일을 열 수 없습니다. 손상·암호 설정을 확인하세요.');}
  const entries=Object.values(zip.files);if(entries.length>200||entries.some(e=>/vbaProject|externalLinks/i.test(e.name)))fail('지원하지 않는 ZIP 구성 또는 매크로/외부 연결입니다.');
  let total=0;const cache=new Map();
  async function part(name){
   if(cache.has(name))return cache.get(name);const e=zip.file(name);if(!e)fail('필수 파일 구조 누락: '+name);
   const chunks=[];let size=0;await new Promise((resolve,reject)=>{const stream=e.internalStream('uint8array');stream.on('data',b=>{size+=b.length;total+=b.length;if(size>4*1024*1024||total>20*1024*1024){stream.pause();reject(new Error('압축 해제 크기 한도 초과'));return;}chunks.push(b);}).on('error',reject).on('end',resolve).resume();});
   const all=new Uint8Array(size);let i=0;for(const b of chunks){all.set(b,i);i+=b.length;}const text=new TextDecoder('utf-8',{fatal:true}).decode(all);
   if(/<!DOCTYPE|<!ENTITY/i.test(text))fail('DTD/ENTITY는 지원하지 않습니다.');const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.getElementsByTagName('parsererror').length)fail('손상된 XML입니다.');cache.set(name,doc);return doc;
  }
  const book=await part('xl/workbook.xml'),rels=[...(await part('xl/_rels/workbook.xml.rels')).getElementsByTagNameNS(rn,'Relationship')];
  if(book.documentElement.namespaceURI!==ns||rels.some(r=>r.getAttribute('TargetMode')==='External'))fail('지원하지 않는 workbook/외부 연결입니다.');
  const sheets=list(book,'sheet'),names=sheets.map(s=>s.getAttribute('name'));
  if(names.length!==5||new Set(names).size!==5||schema.sheetNames.some(n=>!names.includes(n)))fail('v3 공식 양식의 5개 시트가 아닙니다. 구버전은 이 화면에서 지원하지 않습니다.');
  const shared=zip.file('xl/sharedStrings.xml')?list(await part('xl/sharedStrings.xml'),'si').map(s=>list(s,'t').map(t=>t.textContent).join('')):[];
  const maps={};const merged={};
  for(const s of sheets){
   const name=s.getAttribute('name'),id=s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');const rs=rels.filter(r=>r.getAttribute('Id')===id);if(rs.length!==1)fail('시트 연결 오류: '+name);
   const target=rs[0].getAttribute('Target');if(!rs[0].getAttribute('Type').endsWith('/worksheet')||! /^(?:\/xl\/)?worksheets\/[\w.-]+\.xml$/.test(target))fail('지원하지 않는 시트 경로입니다.');
   const doc=await part(target.startsWith('/')?target.slice(1):'xl/'+target);if(doc.documentElement.localName!=='worksheet'||doc.documentElement.namespaceURI!==ns)fail('잘못된 worksheet입니다.');
   const cells=new Map();merged[name]=list(doc,'mergeCell').map(c=>c.getAttribute('ref'));
   for(const c of list(doc,'c')){
    const ref=c.getAttribute('r'),match=/^([A-Z]+)([1-9]\d*)$/.exec(ref||'');if(!match||cells.has(ref))fail(name+': 셀 주소 누락/중복');
    const row=Number(match[2]),column=[...match[1]].reduce((n,x)=>n*26+x.charCodeAt(0)-64,0)-1;
    if(row>10001||column>63||cells.size>=64000)fail(name+': 미리보기 행/열/셀 한도 초과');
    const type=c.getAttribute('t')||'n',formula=list(c,'f').length>0;let value=list(c,'v')[0]?.textContent??'';
    if(type==='inlineStr')value=list(c,'is').flatMap(i=>list(i,'t')).map(t=>t.textContent).join('');
    else if(type==='s'){if(!/^\d+$/.test(value)||Number(value)>=shared.length)fail('잘못된 shared string');value=shared[Number(value)];}
    else if(!['n','b','e','str','d'].includes(type))fail('지원하지 않는 셀 유형');
    cells.set(ref,{ref,row,column,type,formula,value:formula?'[수식: 캐시값 사용 안 함]':value});
   }maps[name]=cells;
  }
  const guide=maps['안내'];if(guide.get('A4')?.value!=='Template version'||guide.get('B4')?.value!==schema.version||guide.get('B4')?.formula)fail('지원 버전은 3.0-minimal-design입니다.');
  const items=[],bySheet={},blockingBySheet={},reports=[];let issueCount=0;
  function issue(name,ref,message,level='보완'){issueCount++;bySheet[name]=(bySheet[name]||0)+1;if(level==='보완')blockingBySheet[name]=(blockingBySheet[name]||0)+1;if(items.length<200)items.push({name,ref,message,level,raw:maps[name].get(ref)?.value??''});}
  const kind=guide.get('B5');if(guide.get('A5')?.value!=='자료 구분')issue('안내','A5','자료 구분 항목명이 다릅니다.');
  if((used(kind)&&!schema.dataKinds.includes(kind?.value))||kind?.formula)issue('안내','B5',used(kind)?'실제/합성 중 선택하세요.':'실제/합성 여부 미기재','확인');
  if(merged['안내'].some(ref=>ref!=='A1:B1'))issue('안내','A1','안내 제목 A1:B1 외 병합 셀은 지원하지 않습니다.');
  for(const c of guide.values())if(c.formula||c.type==='e')issue('안내',c.ref,'수식/오류 셀은 사용하지 않습니다.');
  function number(name,ref,predicate=()=>true,reason='유한 숫자를 입력하세요.'){
   const c=maps[name].get(ref);if(!used(c)){issue(name,ref,'필요한 숫자가 비어 있습니다.');return null;}
   if(c.formula||c.type==='e')return null;
   const s=c.value,n=Number(s),mantissa=s.split(/[eE]/)[0];
   if(c.type!=='n'||! /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)||!Number.isFinite(n)||(n===0&&/[1-9]/.test(mantissa))||!predicate(n)){issue(name,ref,reason);return null;}return n;
  }
  for(const [name,m]of Object.entries(schema.modules)){
   const cells=maps[name],before=issueCount,get=r=>cells.get(r),present=r=>used(get(r));
   if(merged[name].length)issue(name,'A1','병합 셀은 지원하지 않습니다.');
   const checkHeader=(ref,v)=>{if(get(ref)?.value!==v||get(ref)?.formula)issue(name,ref,'공식 양식의 항목명/위치가 다릅니다.');};
   for(const [ref,v]of [['A4','단위'],['A6','분석 이름 / LOT (선택)'],['A7','원기록·기준 참조 (선택)']])checkHeader(ref,v);
   checkHeader('A5',{LoD:'목표 검출확률',Confirmation:'사전 관측 검출률 기준',LoB:'Blank 초과확률 α',LoQ:'허용 총오차 / 기준값'}[name]);
   if(name==='LoQ'){for(const [ref,v]of [['A10','검체 이름'],['A11','기준값 (reference)'],['A12','기준값 출처'],['A14','반복 측정값 ↓']])checkHeader(ref,v);for(let c=1;c<=8;c++)checkHeader(col(c)+'14','검체 입력 '+c);}
   else m.headers.forEach((h,c)=>checkHeader(col(c)+'10',h));
   for(const c of cells.values())if(used(c)){
    if(c.formula||c.type==='e')issue(name,c.ref,'수식/오류 셀은 사용하지 않습니다. 원값을 확인하세요.');
    const data=name==='LoQ'?c.row>=15&&c.row<=1014&&c.column>=1&&c.column<=8:c.row>=11&&c.row<=1010&&c.column<m.headers.length;
    const fixed=(c.column===0&&[1,2,4,5,6,7].includes(c.row))||(c.column===1&&[4,5,6,7].includes(c.row))||(c.column===2&&[4,5,6,7].includes(c.row));
    const heads=name==='LoQ'?([10,11,12,14].includes(c.row)&&c.column<=8):c.row===10&&c.column<m.headers.length;
    if(!data&&!fixed&&!heads)issue(name,c.ref,'공식 입력 영역 밖의 값입니다. 자동으로 버리지 않습니다.');
   }
   const records=[],seenConcentrations=new Map();let count=0;
   if(name==='LoQ'){
    const seen=new Set();for(let c=1;c<=8;c++){const key=col(c),values=[...cells.values()].filter(x=>x.column===c&&x.row>=15&&x.row<=1014&&used(x)).sort((a,b)=>a.row-b.row);
     if(![10,11,12].some(r=>present(key+r))&&!values.length)continue;
     const label=get(key+'10')?.value;if(!label?.trim())issue(name,key+'10','검체 이름을 입력하세요.');else if(seen.has(label))issue(name,key+'10','검체 이름 중복입니다. 자동 합산하지 않습니다.');seen.add(label);
     number(name,key+'11',n=>n>0,'기준값은 같은 단위의 양수여야 합니다.');
     if(!present(key+'12'))issue(name,key+'12','기준값 출처 미기재 · 근거를 확인하세요.','확인');
     if(values.length<2)issue(name,key+'15','SD 계산을 위한 숫자 측정값이 부족합니다. 시험설계 충족 판단은 별도입니다.');
     for(const x of values)number(name,x.ref);count+=values.length;records.push({label:label||key+'열',count:values.length,reference:get(key+'11')?.value??'',preview:values.slice(0,3)});
    }
   }else{
    for(let r=11;r<=1010;r++){const refs=m.headers.map((_,c)=>col(c)+r);if(!refs.some(present))continue;count++;records.push({row:r,preview:refs.map(ref=>get(ref)||{ref,value:''})});
     if(name==='LoB')number(name,refs[0]);else{const concentration=number(name,refs[0],n=>n>0,'농도는 양수여야 합니다. 0 농도는 이 입력 경로에서 지원하지 않습니다.');if(concentration!==null){if(seenConcentrations.has(concentration))issue(name,refs[0],seenConcentrations.get(concentration)+'와 농도가 중복됩니다. 원 셀을 확인하세요. 자동 합산하지 않습니다.');else seenConcentrations.set(concentration,refs[0]);}const n=number(name,refs[1],n=>Number.isSafeInteger(n)&&n>0,'N은 양의 정수여야 합니다.'),k=number(name,refs[2],n=>Number.isSafeInteger(n)&&n>=0,'양성 수는 0 이상의 정수여야 합니다.');if(n!==null&&k!==null&&k>n)issue(name,refs[2],'양성 수가 N보다 큽니다.');}
    }
   }
   const active=records.length>0,settings=[4,5,6,7].filter(r=>present('B'+r)).length;
   if(active&&!get('B4')?.value.trim())issue(name,'B4','단위를 입력하세요.');
   let setting=null;if(present('B5')||active){if(!present('B5')&&['Confirmation','LoQ'].includes(name))issue(name,'B5','사전 기준 미기재 · 기준 판정 불가','확인');else setting=number(name,'B5',n=>name==='LoQ'?n>0:name==='Confirmation'?n>=0&&n<=1:n>0&&n<1,'설정 범위를 확인하세요. Excel에서는 %를 붙여 입력합니다.');}
   reports.push({name,count,sampleCount:name==='LoQ'?records.length:null,settings,setting,unit:get('B4')?.value??'',status:issueCount>before?'보완/확인 필요':active?'기초 형식 확인 · 계산 미실행':settings?'설정만 기입 · 데이터 미제공':'미제공',preview:name==='LoQ'?records:records.slice(0,3)});
  }
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return {filename:file.name,version:schema.version,dataKind:schema.dataKinds.includes(kind?.value)?kind.value:'미기재/확인 필요',sha256:[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join(''),sheets:reports,items,issueCount,bySheet,blockingBySheet,raw:maps};
 }
 return {read};
})();
