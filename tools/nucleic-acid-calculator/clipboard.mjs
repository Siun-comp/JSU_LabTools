import {format,VERSION} from './core.mjs';
import {copyScientific} from './math.mjs';
export const TOOL_VERSION='1.0.0';
const safe=s=>{const v=String(s).replace(/[\t\r\n]/g,c=>c==='\t'?'\\t':c==='\r'?'\\r':'\\n');return /^[=+@-]/.test(v)?"'"+v:v;};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function rows(r){const i=r.input,out=[['항목','값','단위'],['분자 종류',i.type,''],['알려진 농도',i.value,i.unit],['MW 방법',r.basis,''],['계산 MW',r.mw?format(r.mw):'미지정','g/mol']];
 if(r.length)out.push(['전체 길이',r.length,i.type==='ssRNA'||i.type==='ssDNA'?'nt':'bp']);
 if(r.seq)out.push(['계산 서열',r.seq.normalized,'입력 가닥 5′→3′'],['FASTA header',r.seq.header,''],['서열 정리',r.seq.formatNote,'']);
 if(i.method==='direct')out.push(['MW 출처',i.source||'미기록','']);
 if(i.vector){const v=i.vector;out.push(['기본 Vector',v.name,''],['Vector 입력 상태',v.state,''],['Vector 자료',v.sourceFile,''],['Vector 출처',v.sourceUrl,''],['Vector 자료 버전 / 확인',v.dataVersion+' / '+v.checked,''],['Vector 원본 서열 SHA256',v.sequenceHash,''],['Vector 원본 길이',v.length,'bp']);}
 out.push(['질량농도',r.mass?format(r.mass):'분자량 필요',i.massUnit],['몰농도',r.molar?format(r.molar):'분자량 필요',i.molarUnit],['물리적 분자 수 농도',r.copies?format(r.copies):'분자량 필요',i.copyUnit]);const sci=copyScientific(r.copies);if(sci)out.push(['Copy 농도 (지수 요약·3유효숫자)',sci,i.copyUnit]);
 out.push(['Copy 의미','전체 분자 수 · 이중가닥 한 분자=1copy · 소수는 평균 기대량',''],['NA','6.02214076E23','mol⁻¹'],['표시','주값 최대12유효숫자 / Copy 지수 요약3유효숫자 · 모델/측정 정확도 보증 아님',''],['도구 / 알고리즘',TOOL_VERSION+' / '+VERSION,'']);return out;}
export function clipboardData(r){const data=rows(r).map(row=>row.map(safe));return {text:data.map(row=>row.join('\t')).join('\n'),html:'<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body><table style="border-collapse:collapse;font-family:맑은 고딕,Malgun Gothic,sans-serif;font-size:9pt">'+data.map(row=>'<tr>'+row.map(s=>'<td style="font-family:맑은 고딕,Malgun Gothic,sans-serif;font-size:9pt;border:none">'+escape(s)+'</td>').join('')+'</tr>').join('')+'</table></body></html>'};}
