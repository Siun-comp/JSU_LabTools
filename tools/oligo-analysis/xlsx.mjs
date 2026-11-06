import {excelRows} from './core.mjs';

const MAIN='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PACKAGE='http://schemas.openxmlformats.org/package/2006/relationships';
const MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XML='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
// Excel inline strings are literal, including names starting with =, + or @.
const escape=s=>s.replace(/_x[\da-f]{4}_/gi,m=>'_x005F_'+m.slice(1))
 .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,c=>'_x'+c.charCodeAt(0).toString(16).padStart(4,'0')+'_')
 .replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'})[c]);
const font=(name,color,bold=false)=>`<font>${bold?'<b/>':''}<sz val="9"/><color rgb="FF${color}"/><name val="${name}"/></font>`;
const fill=color=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${color}"/><bgColor indexed="64"/></patternFill></fill>`;
const xf=(fontId,fillId,wrap)=>`<xf numFmtId="49" fontId="${fontId}" fillId="${fillId}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1" applyNumberFormat="1"><alignment vertical="top" horizontal="left" wrapText="${+wrap}"/></xf>`;
const styles=`<styleSheet xmlns="${MAIN}"><fonts count="5">${font('Malgun Gothic','1F2937')}${font('Courier New','1F2937')}${font('Malgun Gothic','FFFFFF',true)}${font('Malgun Gothic','173651',true)}${font('Malgun Gothic','A32020',true)}</fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fill('244762')}${fill('DFEDF7')}</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5">${xf(0,0,true)}${xf(1,0,false)}${xf(2,2,true)}${xf(3,3,true)}${xf(4,0,true)}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
const relationships=(type,target)=>`<Relationships xmlns="${PACKAGE}"><Relationship Id="rId1" Type="${REL}/${type}" Target="${target}"/>`;

export async function xlsxReport(records,pairs,mode,meta={},Zip=globalThis.JSZip){
 if(!Zip)throw Error('Excel 저장 기능을 불러오지 못했습니다. 페이지를 다시 열어 주세요.');
 const rows=excelRows(records,pairs,mode,{...meta,grouped:true});
 if(rows.length>1048576||rows.reduce((n,r)=>n+r.text.length,0)>16000000)throw Error('Excel 파일로 저장하기에는 결과가 큽니다. 표시 조건을 좁히거나 TXT 저장을 사용하세요.');
 const zip=new Zip();
 zip.file('[Content_Types].xml',XML+`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
 zip.file('_rels/.rels',XML+relationships('officeDocument','xl/workbook.xml')+'</Relationships>');
 zip.file('xl/workbook.xml',XML+`<workbook xmlns="${MAIN}" xmlns:r="${REL}"><bookViews><workbookView/></bookViews><sheets><sheet name="Oligo-dimer" sheetId="1" r:id="rId1"/></sheets></workbook>`);
 zip.file('xl/_rels/workbook.xml.rels',XML+relationships('worksheet','worksheets/sheet1.xml')+`<Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/></Relationships>`);
 zip.file('xl/styles.xml',XML+styles);
 const cells=rows.map(({text,mono,kind},i)=>{
  const n=i+1,style=mono?1:kind==='section'||i===0?2:kind==='pair'?3:kind==='warning'?4:0;
  const height=mono?16:16*Math.ceil(Math.max(1,text.replace(/[^\x00-\x7F]/g,'xx').length)/210);
  return `<row r="${n}" ht="${height}" customHeight="1"><c r="A${n}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escape(text)}</t></is></c></row>`;
 });
 zip.file('xl/worksheets/sheet1.xml',XML+`<worksheet xmlns="${MAIN}"><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><sheetFormatPr defaultRowHeight="16"/><cols><col min="1" max="1" width="220" customWidth="1"/></cols><sheetData>${cells.join('')}</sheetData></worksheet>`);
 return zip.generateAsync({type:'blob',mimeType:MIME,compression:'DEFLATE'});
}
