/* Static result snapshots only. No formulas, statistical calculations or network calls.
 * Browser fallback for the Node-only private artifact authoring runtime.
 * OOXML SpreadsheetML + the existing pinned JSZip 3.10.1. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./vendor/jszip.min.js'));else root.BrowserExcel=factory(root.JSZip);})(globalThis,JSZip=>{
 'use strict';
 const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main',REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships',PKG='http://schemas.openxmlformats.org/package/2006/relationships',MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
 const names={lod:'LoD',confirmation:'LoD confirmation',lob:'LoB',loq:'LoQ'},tabs=['분석 결과','분석 입력','계산 근거'];
 const xml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\r/g,'&#13;');
 // Preserve XML-forbidden characters using SpreadsheetML escapes. Escape literal
 // _xHHHH_ sequences first so user text cannot be interpreted as an escape.
 function text(s){s=String(s).replace(/_x[0-9a-f]{4}_/gi,m=>'_x005F_'+m.slice(1));let out='';for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(c>=0xd800&&c<=0xdbff&&s.charCodeAt(i+1)>=0xdc00&&s.charCodeAt(i+1)<=0xdfff){out+=s[i]+s[++i];continue;}out+=(c<32&&![9,10,13].includes(c)||c===0xfffe||c===0xffff||c>=0xd800&&c<=0xdfff)?'_x'+c.toString(16).toUpperCase().padStart(4,'0')+'_':s[i];}return xml(out);}
 const col=i=>{let n=i+1,s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;};
 const chunks=(s,n)=>{const chars=Array.from(s),out=[];for(let i=0;i<chars.length;i+=n)out.push(chars.slice(i,i+n).join(''));return out.length?out:[''];};
 const weight=s=>Array.from(String(s??'')).reduce((n,c)=>n+(c.codePointAt(0)>255?2:1),0);
 function png(data){if(data===null)return null;if(typeof data!=='string'||data.length>3000000||!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(data))throw Error('input_blocked');let bytes;try{bytes=Uint8Array.from(atob(data.slice(22)),c=>c.charCodeAt(0));}catch{throw Error('input_blocked');}if(bytes.length<33||![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)||String.fromCharCode(...bytes.slice(12,16))!=='IHDR')throw Error('input_blocked');const dv=new DataView(bytes.buffer),w=dv.getUint32(16),h=dv.getUint32(20);if(w!==1600||h<100||h>2500)throw Error('input_blocked');return {bytes,width:w,height:h};}
 function validReport(q){try{if(!q||q.version!=='excel-report-1'||!Object.hasOwn(names,q.module)||Object.keys(q).some(k=>!['version','module','summary','input','details','graph'].includes(k)))return false;let total=0;for(const grid of [q.summary,q.input,q.details]){if(!Array.isArray(grid)||grid.length>10000)return false;for(const r of grid){if(!Array.isArray(r)||r.length>12)return false;for(const v of r){if(v===null)continue;if(typeof v==='number'){if(!Number.isFinite(v))return false;}else if(typeof v!=='string'||v.length>32000)return false;else total+=v.length;}}}return total<=6000000&&(png(q.graph),true);}catch{return false;}}
 function build(q){if(!validReport(q))throw Error('input_blocked');const image=png(q.graph),styles=[],styleMap=new Map();
  // font0 body,1 navy title,2 muted subtitle,3 white header; fill0/1 required,
  // fill2 white,3 pale,4 navy. 164 decimal,165 scientific,166 percent.
  function style(font=0,fill=2,format=0,align='left',border=0){const key=[font,fill,format,align,border].join('/');if(!styleMap.has(key)){styleMap.set(key,styles.length);styles.push(`<xf numFmtId="${format}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="${align}" vertical="center" wrapText="1"/></xf>`);}return styleMap.get(key);}
  style();const numberFormat=(v,label)=>/fraction|양측95% CI/.test(label)||label==='설정 (%)'?166:/^(N|양성|음성|입력 순번)$/.test(label)?1:Math.abs(v)>0&&(Math.abs(v)<.0001||Math.abs(v)>=1e9)?165:Number.isInteger(v)?1:164;
  function sheet(name,subtitle,index){const rows=new Map(),merges=[];let maxCol=9,end=4,graphRow=null;
   function row(r,height=28){if(r>65000)throw Error('input_blocked');end=Math.max(end,r);if(!rows.has(r))rows.set(r,{cells:new Map(),height});rows.get(r).height=Math.min(409,height);return rows.get(r);}
   function cell(r,c,v,sty,height){const rr=row(r,height);maxCol=Math.max(maxCol,c);rr.cells.set(c,{v,sty});}
   function band(r,start,last,v,sty,height){merges.push(`${col(start)}${r}:${col(last)}${r}`);for(let c=start;c<=last;c++)cell(r,c,c===start?v:null,sty,height);}
   band(1,0,9,names[q.module]+' '+name,style(1),38);band(2,0,9,subtitle,style(2,2,0,'left',1),28);
   const section=(r,title)=>band(r,0,9,title,style(3,4),28);
   function write(start,grid){let r=start,headers=null;
    for(const original of grid){if(!original.length){r++;headers=null;continue;}
     const split=original.map(v=>typeof v==='string'?chunks(v,120):[v]),count=original.length>2?Math.max(...split.map(c=>c.length)):1;
     for(let part=0;part<count;part++){const values=count===1?original:split.map((v,c)=>typeof original[c]==='string'?(v[part]??''):part?'':v[0]);
      const pair=values.length===2&&typeof values[0]==='string'&&values[0]!=='입력 순번'&&(!headers||headers.length!==values.length);
      if(pair){headers=null;const [label,value]=values,parts=typeof value==='string'?chunks(value,240):[value],labels=chunks(label,240),length=Math.max(parts.length,labels.length);
       for(let i=0;i<length;i++,r++){const l=(labels[i]??(labels.length===1?label+' (계속)':'')),v=parts[i]??'',h=Math.max(28,Math.ceil(Math.max(weight(l)/35,weight(v)/90))*18+8);band(r,0,2,l.replace('(fraction)','(%)'),style(0,3),h);const n=label==='설정 (%)'&&typeof v==='number'?v/100:v;band(r,3,9,n,style(0,2,typeof n==='number'?numberFormat(n,label):0,typeof n==='number'?'right':'left'),h);}continue;
      }
      const head=!headers&&values.every(v=>typeof v==='string');if(head)headers=values;const h=Math.max(head?40:28,Math.ceil(Math.max(...values.map(v=>typeof v==='string'?weight(v)/12:1)))*16+8);
      const caption=v=>v.replace('(fraction)','(%)').replace('양측95% CI 하한','양측95% CI\n하한').replace('양측95% CI 상한','양측95% CI\n상한').replace('사전 관측률 기준','사전 관측률\n기준').replace('TE/기준값 (%)','TE/기준값\n(%)');
      values.forEach((v,c)=>cell(r,c,head&&typeof v==='string'?caption(v):v,style(head?3:0,head?4:r%2?3:2,typeof v==='number'?numberFormat(v,headers?.[c]||''):0,head?'center':typeof v==='number'?'right':'left',head?2:0),h));r++;
     }
    }return r;
   }
   if(index===0){section(4,'결과 요약');const cut=q.summary.findIndex(r=>!r.length),head=cut<0?q.summary:q.summary.slice(0,cut),tail=cut<0?[]:q.summary.slice(cut+1);let r=write(5,head);section(++r,'그래프');r++;
    if(image){graphRow=r;const count=Math.ceil((1000*image.height/image.width)/32);for(let i=0;i<=count;i++)row(r+i,24);r+=count+2;}else r=write(r,[['그래프','지원 범위에서 그래프를 제공하지 않습니다. 전체 수치는 아래 결과 표를 확인하세요.']]);section(r++,'결과 표·방법');write(r,tail);
   }else{section(4,index===1?'입력값·설정':'상세 계산 기록');write(5,index===1?q.input:q.details);}
   const body=[...rows].sort((a,b)=>a[0]-b[0]).map(([r,rr])=>`<row r="${r}" ht="${rr.height}" customHeight="1">`+[...rr.cells].sort((a,b)=>a[0]-b[0]).map(([c,{v,sty}])=>`<c r="${col(c)}${r}" s="${sty}"${typeof v==='number'?'':' t="inlineStr"'}>`+(v===null?'':typeof v==='number'?`<v>${v}</v>`:`<is><t xml:space="preserve">${text(v)}</t></is>`)+ '</c>').join('')+'</row>').join('');
   const view=index===0?'<selection activeCell="A1" sqref="A1"/>':'<pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A5" sqref="A5"/>';
   const data=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${NS}" xmlns:r="${REL}"><sheetPr><tabColor rgb="FF183653"/><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${col(maxCol)}${end}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0">${view}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="24"/><cols><col min="1" max="${maxCol+1}" width="13.57" customWidth="1"/></cols><sheetData>${body}</sheetData><mergeCells count="${merges.length}">${merges.map(m=>`<mergeCell ref="${m}"/>`).join('')}</mergeCells><pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.15" footer="0.15"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>${graphRow?'<drawing r:id="rId1"/>':''}</worksheet>`;
   return {name,data,end,maxCol,graphRow};
  }
  const sheets=[sheet(tabs[0],'계산 결과 기록 · 셀을 수정해도 통계가 재계산되지 않습니다.',0),sheet(tabs[1],'계산에 사용한 입력 기록 · 웹툴에 다시 불러오는 공식 입력 양식이 아닙니다.',1),sheet(tabs[2],'방법·설정·정밀 수치 · Excel 숫자 정밀도 한계가 있으므로 원문 보관은 작업 JSON을 사용하세요.',2)];
  const fonts=[['11','203044',false],['20','183653',true],['10','526579',false],['11','FFFFFF',true]].map(([sz,color,b])=>`<font>${b?'<b/>':''}<sz val="${sz}"/><color rgb="FF${color}"/><name val="Malgun Gothic"/><charset val="129"/></font>`).join('');
  const fills='<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'+['FFFFFF','EFF3F7','183653'].map(c=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`).join('');
  const styleXML=`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="${NS}"><numFmts count="3"><numFmt numFmtId="164" formatCode="0.000000"/><numFmt numFmtId="165" formatCode="0.000000E+00"/><numFmt numFmtId="166" formatCode="0.00%"/></numFmts><fonts count="4">${fonts}</fonts><fills count="5">${fills}</fills><borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="medium"><color rgb="FF183653"/></bottom><diagonal/></border><border><left/><right style="thin"><color rgb="FFFFFFFF"/></right><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${styles.length}">${styles.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return {sheets,styleXML,image};
 }
 async function generate(q,{signal,onProgress}={}){if(!JSZip)throw Error('excel_runtime_unavailable');const check=()=>{if(signal?.aborted)throw Error('aborted');};check();const snapshot=structuredClone(q),{sheets,styleXML,image}=build(snapshot),zip=new JSZip();check();
  const rel=(id,type,target)=>`<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"/>`,relations=rs=>`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${PKG}">${rs}</Relationships>`;
  const override=(part,type)=>`<Override PartName="/${part}" ContentType="application/vnd.openxmlformats-officedocument.${type}+xml"/>`;
  zip.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${image?'<Default Extension="png" ContentType="image/png"/>':''}${override('xl/workbook.xml','spreadsheetml.sheet.main')}${override('xl/styles.xml','spreadsheetml.styles')}${sheets.map((s,i)=>override('xl/worksheets/sheet'+(i+1)+'.xml','spreadsheetml.worksheet')).join('')}${image?override('xl/drawings/drawing1.xml','drawing'):''}</Types>`);
  zip.file('_rels/.rels',relations(rel('rId1','officeDocument','xl/workbook.xml')));
  zip.file('xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${NS}" xmlns:r="${REL}"><bookViews><workbookView/></bookViews><sheets>${sheets.map((s,i)=>`<sheet name="${s.name}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets><definedNames>${sheets.map((s,i)=>`<definedName name="_xlnm.Print_Area" localSheetId="${i}">'${s.name}'!$A$1:$${col(s.maxCol)}$${s.end}</definedName>`).join('')}</definedNames></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels',relations(sheets.map((s,i)=>rel('rId'+(i+1),'worksheet','worksheets/sheet'+(i+1)+'.xml')).join('')+rel('rId4','styles','styles.xml')));zip.file('xl/styles.xml',styleXML);sheets.forEach((s,i)=>zip.file('xl/worksheets/sheet'+(i+1)+'.xml',s.data));
  if(image){const r=sheets[0].graphRow-1;zip.file('xl/media/image1.png',image.bytes);zip.file('xl/worksheets/_rels/sheet1.xml.rels',relations(rel('rId1','drawing','../drawings/drawing1.xml')));zip.file('xl/drawings/_rels/drawing1.xml.rels',relations(rel('rId1','image','../media/image1.png')));
   zip.file('xl/drawings/drawing1.xml',`<?xml version="1.0" encoding="UTF-8"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${REL}"><xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${r}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="9525000" cy="${Math.round(1000*image.height/image.width*9525)}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="1" name="분석 그래프"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9525000" cy="${Math.round(1000*image.height/image.width*9525)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`);
  }
  const blob=await zip.generateAsync({type:'blob',mimeType:MIME,compression:'DEFLATE',compressionOptions:{level:6}},()=>{check();onProgress?.();});check();return blob;
 }
 return {version:'browser-excel-1',validReport,build,generate};
});
