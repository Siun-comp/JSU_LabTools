import {format, VERSION} from './core.mjs';
export const TOOL_VERSION='1.0.0';
export function resultRows(r) {
  const i=r.input, u=i.volumeUnit;
  const rows=[['항목','값','단위'],['계산 모드',i.mode==='final'?'원하는 양 만들기':'Stock 전량 희석',''],['농도 종류',i.family==='mixed'?'몰↔질량':i.family==='molar'?'몰농도':'질량농도',''],['Stock 농도',i.stock,i.stockUnit],['목표 농도',i.target,i.targetUnit],[i.mode==='final'?'지정 최종 부피':'보유 Stock 부피',i.volume,u],['Stock 사용량',format(r.stockVolume),u],['희석액 추가량 (이론)',format(r.diluentVolume),u],['최종 부피',format(r.finalVolume),u],['희석 배수',format(r.factor),'배']];
  if(r.mw) rows.push(['직접 입력 분자량',i.molecularWeight,'g/mol'],['환산 Stock 농도',format(r.normalizedStock),r.normalizedUnit],['환산 목표 농도',format(r.normalizedTarget),r.normalizedUnit],['환산 방법','질량농도[g/L] ÷ MW[g/mol] = 몰농도[mol/L]','']);
  rows.push(['방법','C1V1=C2V2 · 동일 용질 · 부피 가산 가정',''],['조제 기준','Stock을 사용하여 희석액으로 최종 부피까지 맞춤',''],['도구 / 알고리즘',TOOL_VERSION+' / '+VERSION,''],['표시 정밀도','최대 12 유효숫자 · 계산값의 표시만 반올림','']);return rows;
}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function tableData(rows) {
  return {text:rows.map(row=>row.join('\t')).join('\n'),html:'<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body><table style="border-collapse:collapse;font-family:맑은 고딕,Malgun Gothic,sans-serif;font-size:9pt">'+rows.map(row=>'<tr>'+row.map(value=>'<td style="font-family:맑은 고딕,Malgun Gothic,sans-serif;font-size:9pt;border:none">'+escape(value)+'</td>').join('')+'</tr>').join('')+'</table></body></html>'};
}
export const clipboardData=r=>tableData(resultRows(r));
export function conversionClipboard(r) {
  const i=r.input;
  return tableData([['항목','값','단위'],['계산 종류',i.kind==='amount'?'총량':'농도',''],['환산 방향',i.direction==='molar-to-mass'?'몰→질량':'질량→몰',''],['입력',i.value,i.inputUnit],['직접 입력 분자량',i.molecularWeight,'g/mol'],['결과',format(r.value),i.outputUnit],['방법',i.kind==='amount'?'질량[g] = 물질량[mol] × MW[g/mol]':'질량농도[g/L] = 몰농도[mol/L] × MW[g/mol]',''],['분자량 근거','사용자 직접 입력 · 출처 미기록',''],['도구 / 알고리즘',TOOL_VERSION+' / '+VERSION,''],['표시 정밀도','최대 12 유효숫자 · 표시만 반올림','']]);
}
export function preparationClipboard(r) {
  const i=r.input,mass=i.mode==='mass';
  return tableData([['항목','값','단위'],['계산 모드',mass?'필요한 질량 구하기':'보유 질량으로 최종 부피 구하기',''],['목표 몰농도',i.concentration,i.concentrationUnit],['직접 입력 분자량',i.molecularWeight,'g/mol'],[mass?'지정 최종 부피':'보유 질량',i.known,i.knownUnit],[mass?'필요한 시약 질량':'맞출 최종 부피',format(r.value),i.outputUnit],['방법',mass?'질량[g] = 몰농도[mol/L] × 최종 부피[L] × MW[g/mol]':'최종 부피[L] = 질량[g] ÷ (몰농도[mol/L] × MW[g/mol])',''],['조제 기준','시약을 용해한 뒤 용매로 최종 부피까지 맞춤 · 용매 첨가량 자체가 아님',''],['분자량 근거','사용자 직접 입력 · 출처 미기록',''],['도구 / 알고리즘',TOOL_VERSION+' / '+VERSION,''],['표시 정밀도','최대 12 유효숫자 · 표시만 반올림','']]);
}
