// Entirely synthetic: date effects, detection-band effects and data-quality cases.
// Collection institution is intentionally absent, as in the six-column input.
export function exampleData(){
  const rows=[],dates=['2025-12-15','2026-01-15','2026-02-15'],centers=[18,26,34,39];
  for(let d=0;d<3;d++)for(let b=0;b<4;b++)for(let j=0;j<6;j++){
    const x=centers[b]+(j-2.5)*.55,y=4+.58*x+(d===2?2.3:d===1?.7:0)+(j%3-1)*.65;
    const missed=(b===3&&j<(d===0?1:d===1?2:3))||(b===2&&d===2&&j===0);
    const invalid=d===1&&b===2&&j===5;
    rows.push([`EX-P${String(rows.length+1).padStart(3,'0')}`,dates[d],'Positive',x.toFixed(3),invalid?'Invalid':missed?'ND':'Positive',invalid||missed?'':y.toFixed(3)]);
  }
  for(let d=0;d<3;d++)for(let j=0;j<8;j++){const discordant=j<(d===2?2:d===1?1:0);rows.push([`EX-N${d+1}-${j+1}`,dates[d],'Negative','',discordant?'Positive':'ND',discordant?(25+j).toFixed(3):'']);}
  rows.push(
    ['EX-HIGH-OUTLIER','2026-02-15','Positive','25','Positive','39'],
    ['EX-LOW-OUTLIER','2026-01-15','Positive','32','Positive','8'],
    ['EX-NO-DATE-1','','Positive','23.5','Positive','18.4'],
    ['EX-NO-DATE-2','','Negative','','ND',''],
    ['EX-NO-PRODUCT-VALUE','2026-01-15','Positive','29','Positive',''],
    ['EX-NO-REFERENCE-VALUE','2026-02-15','Positive','','Positive','23'],
    ['EX-NO-PRODUCT-RESULT','2026-02-15','Positive','37','',''],
    ['EX-REFERENCE-INVALID','2026-01-15','Invalid','','ND',''],
    ['EX-DUPLICATE','2026-01-15','Positive','24','Positive','18.2'],
    ['EX-DUPLICATE','2026-02-15','Positive','25.5','Positive','20.1'],
    ['','2026-01-15','Positive','21','Positive','16'],
    ['EX-BAD-DATE','날짜 오류','Positive','22','Positive','17'],
    ['EX-BAD-VALUE','2026-02-15','Positive','값 오류','Positive','20'],
    ['EX-BAD-RESULT','2026-02-15','Positive','31','1','19'],
    ['EX-ND-WITH-VALUE','2026-02-15','Positive','38','ND','30']
  );
  return rows;
}
export const EXAMPLE_DESCRIPTION='합성 예제 111행: 3개 채취일, 4개 검출값 대역, 날짜별 Product 값 이동·고검출값 구간 미검출 증가, 양성/음성 불일치, PI 이탈 후보, Invalid·누락·중복 ID·형식 오류를 포함합니다. 실제 검체나 성능 검증 자료가 아닙니다.';
