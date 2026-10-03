(function(root){
 'use strict';
 // Single source for the displayed application release. Newest release first.
 const releases=[{version:'0.9.1-beta.1',date:'2026-10-04',status:'포털 파생 베타 · 사용 검토용',changes:[
  'JSU LabTools의 공통 테마와 독립 새 탭 실행을 적용한 포털 파생판입니다.',
  '원 프로그램 v0.9.0-beta.6의 계산 기반과 webR/R 버전을 유지했습니다.',
  '동일 농도 중복 위치 안내·누락값 검사와 입력 원문 보존을 포함합니다.',
  '고정 수치·입력/복원/출력·표준 예제 대조 근거와 제공 범위를 정리했습니다.'
 ],calculationImpact:'통계 R 본문·모형·CI·결과 조립 및 파일 형식 변경 없음. 포털 테마/탐색·입력검사 이력과 새 프로그램 식별을 구별합니다.',limitations:'사용 검토용 베타입니다. 회사 시험의 적용 기준·최종 보고는 내부에서 확인합니다. 첫 R 분석 때 고정 계산 환경을 외부에서 내려받습니다.'},
 {version:'0.9.0-beta.6',date:'2026-10-01',status:'공개 베타 · 사용 검토용',changes:[
  'GitHub Pages 공개 사이트의 안내를 현재 배포 상태에 맞게 정리했습니다.',
  '기존 배포 준비 이력은 보존하고 현재 버전의 제한사항을 구분했습니다.'
 ],calculationImpact:'계산식·입력·그래프·Excel 작성기 변경 없음. 안내와 프로그램 버전 표시만 변경했습니다.',limitations:'실제 Excel 붙여넣기·결과서 화면/인쇄와 최종 사용자 검토는 남아 있습니다. 인증 또는 허가 적합성 승인을 뜻하지 않습니다. 첫 R 실행에는 외부 계산 환경 다운로드가 필요합니다.'},
 {version:'0.9.0-beta.5',date:'2026-10-01',status:'Pages 배포 준비 베타',changes:[
  '정적 배포용 파일만 분리하고 공식 양식과 네 분석 합성 예제의 상대 다운로드 경로를 구성했습니다.',
  '배포본에서 사용 안내와 외부 구성요소·라이선스 출처를 확인할 수 있습니다.'
 ],calculationImpact:'통계 계산식·입력·결과서 작성 방식 변경 없음. 배포 파일 구성·다운로드 경로·출처 안내만 변경했습니다.',limitations:'GitHub Pages 실제 공개 배포·Excel 화면/인쇄·최종 사용자 검토는 미완료입니다. 첫 R 실행은 외부 계산 환경 다운로드가 필요합니다.'},
 {version:'0.9.0-beta.4',date:'2026-10-01',status:'Pages 배포 준비 베타',changes:[
  '네 분석의 3시트 Excel 결과서를 브라우저 안에서 생성하며 별도 서버나 분석 데이터 업로드가 필요하지 않습니다.',
  '흰 바탕·남색 결과서, 숫자·백분율·원비율 그래프와 상세 계산 근거를 유지합니다.',
  'LoB에도 계산 당시 프로그램 버전을 기록합니다. 이전 결과의 버전은 소급 변경하지 않습니다.'
 ],calculationImpact:'통계 계산식·입력·기준·보류 정책 변경 없음. Excel 파일 생성 위치와 파일 작성 구현을 변경했습니다.',limitations:'실제 GitHub Pages HTTPS 배포, Excel 화면·인쇄 및 최종 사용자 검토는 남아 있습니다. 인증 또는 허가 적합성 승인을 뜻하지 않습니다.'},
 {version:'0.9.0-beta.3',date:'2026-09-30',status:'Pages 전환 중 베타',changes:[
  'confirmation·LoQ의 기존 R 계산을 브라우저로 전환해 네 분석이 모두 서버 없이 계산됩니다.',
  'LoD·confirmation·LoQ가 하나의 R 환경을 공유하며 취소·입력 변경 보호와 계산 버전 출처를 유지합니다.'
 ],calculationImpact:'계산식·입력·기준 비교·보류 정책을 유지합니다. confirmation·LoQ 실행 환경은 로컬 R4.6.1에서 webR0.6.0/R4.6.0으로 바뀌며 기존 고정 예제로 대조했습니다.',limitations:'Excel 결과서 다운로드는 아직 로컬 서버에 의존합니다. 실제 Pages 배포·최종 사용자 검토·허가 적합성 승인은 미완료입니다.'},
 {version:'0.9.0-beta.2',date:'2026-09-30',status:'Pages 전환 중 베타',changes:[
  'LoD 모형·CI·곡선 계산을 기존 R 코드 기반 브라우저 webR 실행으로 전환했습니다.',
  '계산 취소·시간 초과·입력 변경 보호와 계산 당시 프로그램/실행 환경 출처를 추가했습니다.'
 ],calculationImpact:'통계식·지원 입력·CI 보류 규칙은 유지합니다. 실행 환경은 로컬 R4.6.1에서 webR0.6.0/R4.6.0/MASS7.3-65로 변경되며 고정 예제의 수치 대조를 수행했습니다.',limitations:'confirmation·LoQ 계산 및 Excel 결과서 다운로드는 아직 로컬 서버에 의존합니다. GitHub Pages 실배포·전체 전환·최종 사용자 승인은 미완료입니다.'},
 {version:'0.9.0-beta.1',date:'2026-09-12',status:'사용 검토용 베타',changes:[
  '프로그램 버전 및 개발·배포자 Jang Si Un 표기를 추가했습니다.',
  '페이지에서 버전별 변경 이력을 확인할 수 있습니다.',
  '현재 기능 기준선: LoD 추정·confirmation·LoB·LoQ, 공식 Excel 입력, 표·그래프 복사, 작업 JSON, 3시트 Excel 결과서.',
  '흰 바탕·남색 포인트와 최소 입력 구성을 유지합니다.'
 ],calculationImpact:'이번 변경은 버전·개발자·이력 표시만 추가하며 계산식과 분석 입력을 변경하지 않습니다.',limitations:'실제 Excel 화면·인쇄, 배포 환경 및 최종 사용자 검토는 남아 있습니다. 인증 또는 허가 적합성 승인을 뜻하지 않습니다.'}];
 const release=Object.freeze({developer:'Jang Si Un',version:releases[0].version,baselineProgramVersion:'0.9.0-beta.6',releases});
 if(typeof module==='object'&&module.exports)module.exports=release;
 root.AppRelease=release;
 if(typeof document==='undefined')return;
 const badge=document.getElementById('app-release-badge');
 if(badge)badge.textContent='v'+release.version+' · '+releases[0].status;
 const host=document.getElementById('app-release-info');if(!host)return;
 const by=document.createElement('p');by.textContent='개발·배포: '+release.developer+' · v'+release.version;host.append(by);
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='버전 및 변경 이력';details.append(summary);
 for(const entry of releases){const section=document.createElement('section'),h=document.createElement('h3');h.textContent=(entry.version===release.version?'포털 파생판':'원 프로그램 이력')+' · v'+entry.version+' · '+entry.date+' · '+entry.status;section.append(h);
  const ul=document.createElement('ul');for(const change of entry.changes){const li=document.createElement('li');li.textContent=change;ul.append(li);}section.append(ul);
  for(const text of ['계산 영향: '+entry.calculationImpact,'확인 필요: '+entry.limitations]){const p=document.createElement('p');p.textContent=text;section.append(p);}details.append(section);
 }host.append(details);
})(typeof window==='undefined'?globalThis:window);
