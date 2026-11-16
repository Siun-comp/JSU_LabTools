import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {passingBablokXY,passingBablok,cusum} from '../../tools/method-comparison/passing-bablok.mjs';
import {R_PACKAGES,relativeDifference} from '../../tools/method-comparison/r-check.mjs';
import {createHash} from 'node:crypto';
import {normalize,buildModel} from '../../tools/method-comparison/core.mjs';
import {resultContract,numericRows,specimenData,outputSelection} from '../../tools/method-comparison/result-contract.mjs';
import {reportData} from '../../tools/method-comparison/report-export.mjs';
import {unifiedReportData} from '../../tools/method-comparison/unified-report.mjs';
import {numericScreen} from '../../tools/method-comparison/numeric-screen.mjs';
import {quantitativeExampleData} from '../../tools/method-comparison/example.mjs';
const stage=import.meta.dirname,tool=path.join(stage,'../../tools/method-comparison');
const oracle=JSON.parse(fs.readFileSync(path.join(stage,'pb-oracle.json'),'utf8'));
const num=v=>v==='Inf'?Infinity:v==='-Inf'?-Infinity:v;
const close=(a,b,label)=>{const d=relativeDifference(a,b);assert(d!==null&&d<=1e-12,`${label}: ${a} != ${b}`);};
const tests=[];const test=(name,fn)=>{fn();tests.push(name);};
test('21 synthetic cases equal R mcr PaBa (analytical CI)',()=>{
 assert.equal(oracle.cases.length,21);assert.equal(oracle.environment.packages,'Rcpp 1.1.2, robslopes 1.1.4, mcr 1.3.3.1');
 for(const c of oracle.cases){const r=passingBablokXY(c.x,c.y,c.confidence),e=c.expected;
  close(r.slope,e.slope,c.name+' slope');close(r.intercept,e.intercept,c.name+' intercept');
  const open=e.slopeCI.map(num).some(v=>!Number.isFinite(v));
  if(open){assert.equal(r.slopeCI,null,c.name);assert.equal(r.interceptCI,null,c.name);assert(r.reasons.some(t=>t.includes('CI')),c.name);}
  else{e.slopeCI.forEach((v,i)=>close(r.slopeCI[i],v,c.name+' slopeCI'+i));e.interceptCI.forEach((v,i)=>close(r.interceptCI[i],v,c.name+' interceptCI'+i));}}});
test('row order does not change the result',()=>{for(const c of oracle.cases.slice(0,12)){const idx=c.x.map((_,i)=>i).reverse(),a=passingBablokXY(c.x,c.y,c.confidence),b=passingBablokXY(idx.map(i=>c.x[i]),idx.map(i=>c.y[i]),c.confidence);close(b.slope,a.slope,c.name);close(b.intercept,a.intercept,c.name);if(a.slopeCI){close(b.slopeCI[0],a.slopeCI[0],c.name);close(b.slopeCI[1],a.slopeCI[1],c.name);}}});
test('blocked inputs carry reasons and no values',()=>{
 const two=passingBablokXY([1,2],[1,2]);assert.equal(two.slope,null);assert(two.reasons[0].includes('3개'));
 const neg=passingBablokXY([1,2,3,4,5],[5,4.2,3.1,2,1]);assert.equal(neg.slope,null);assert(neg.reasons[0].includes('음의 관계'));
 const same=passingBablokXY([2,2,2],[2,2,2]);assert.equal(same.slope,null);
 assert.throws(()=>passingBablokXY([1,2,3],[1,2],.95));assert.throws(()=>passingBablokXY([1,2,3],[1,2,3],1));
 const nonfinite=passingBablokXY([1,2,NaN],[1,2,3]);assert.equal(nonfinite.slope,null);});
test('negative values are computed but flagged (R mcr refuses PaBa for negative data)',()=>{const r=passingBablokXY([-1,0,1,2,3],[-0.9,0.1,1.2,1.9,3.1]);assert(Number.isFinite(r.slope));assert.equal(r.negativeValues,true);assert.equal(passingBablokXY([0,1,2],[0,1,2]).negativeValues,false);});
test('cusum linearity statistic: hand-worked six-point example',()=>{
 // line y=x; residual signs + − + − + + → 4 above, 2 below; scores +√(2/4), −√(4/2); running max |sum| = √2
 const c=cusum([1,2,3,4,5,6],[1.5,1.5,3.5,3.5,5.5,6.5],0,1,.95);
 assert.equal(c.above,4);assert.equal(c.below,2);close(c.statistic,Math.SQRT2/Math.sqrt(3),'cusum');assert.equal(c.critical,1.36);assert.equal(c.exceeds,false);
 assert.equal(cusum([1,2,3],[2,3,4],0,1).statistic,null);assert.equal(cusum([1,2,3],[2,1,4],0,0).statistic,null);assert.equal(cusum([1,2,3],[2,1,4],0,1,.8).critical,null);});
test('rows wrapper uses only eligible numeric pairs',()=>{const rows=[{pair:true,x:1,y:1.1},{pair:true,x:2,y:2.2},{pair:false,x:9,y:0},{pair:true,x:3,y:2.9},{pair:true,x:4,y:NaN},{pair:true,x:5,y:5.2}];const r=passingBablok(rows);assert.equal(r.n,4);assert.equal(r.pairs.length,4);});
test('fixed R package files match their pinned SHA-256',()=>{for(const p of R_PACKAGES){const sha=f=>createHash('sha256').update(fs.readFileSync(path.join(tool,'runtime',`${p.name}_${p.version}.${f}`))).digest('hex');assert.equal(sha('tgz'),p.sha256,p.name);assert.equal(sha('metadata.json'),p.metadataSHA256,p.name);}});
test('PB view: result contract, screen, specimen list and Excel rows (quantitative synthetic example)',()=>{
 const rows=normalize(quantitativeExampleData().map((cells,i)=>({cells,sourceRow:i+1})));
 const comparison={independent:true,sameScale:true,unit:'log10 copies/mL',xUnit:'log10 copies/mL',yUnit:'log10 copies/mL',lambdaSource:'equal',lambda:1};
 const snap={rows,comparison,confidence:.95,piLevel:.95,method:'exact',source:'synthetic',ct:[],dates:[],median:[],model:buildModel(rows)};
 const r=resultContract(snap,rows,{method:'pb',overlay:true,equality:true});
 assert.equal(r.method,'pb');assert.equal(r.pb.n,snap.model.n);assert(r.overlay&&r.equality);
 const xy=rows.filter(p=>p.eligible&&p.pair);const direct=passingBablokXY(xy.map(p=>p.x),xy.map(p=>p.y),.95);close(r.pb.slope,direct.slope,'contract slope');
 assert(r.pb.slopeCI[0]>1,'synthetic proportional difference visible in PB');assert(r.model.slopeCI[0]<1,'outliers keep OLS CI around 1');
 const html=numericScreen(r,()=>'<svg></svg>');for(const t of ['Passing–Bablok 계수','세 방법 나란히 보기','r-check-run','직선성 확인','<h3 data-no-copy>R로 다시 계산해 대조'])assert(html.includes(t),t);
 const n=numericRows(r,true);for(const k of ['회귀 방법','기울기 CI 하한','직선성 cusum 통계량','세 방법 나란히: Deming','기울기 쌍 수 N'])assert(n.some(v=>v[0]===k),k);assert.equal(n.find(v=>v[0]==='회귀 방법')[1],'Passing–Bablok');
 const sp=specimenData(rows.slice(0,3),snap.model,'pb',true,r);assert(sp.headers.includes('Product − PB 예상값 (Y방향 차이)'));close(sp.rows[0].at(-1),rows[0].y-(r.pb.intercept+r.pb.slope*rows[0].x),'specimen delta');
 const sheets=unifiedReportData(reportData(snap,rows,'synthetic'),snap,rows,'synthetic',outputSelection('numeric',[],{method:'pb',overlay:true,equality:true}));
 const sheet=sheets.find(v=>v.name==='수치관계');assert(sheet.curveNames.includes('전체 Passing–Bablok'));assert(sheet.rows.some(v=>v[0]==='Passing–Bablok 방법'));
 sheet.curves.forEach(row=>close(row[sheet.curveNames.indexOf('전체 Passing–Bablok')+1].value,r.pb.intercept+r.pb.slope*row[0].value,'curve'));
 const off=resultContract({...snap,comparison:{...comparison,independent:false}},rows,{method:'pb'});assert.equal(off.pb,null);assert(off.pbReasons.length);assert(numericScreen(off,()=>'').includes('Passing–Bablok 미설정'));
 const withCheck=resultContract(snap,rows,{method:'pb',rCheck:{environment:{webR:'0.6.0',r:'4.6.0',packages:'p'},summary:'R 대조: 합성',rows:[['PB 기울기',1,1,0]],notes:[]}});assert(numericRows(withCheck).some(v=>v[0]==='R 대조: PB 기울기'));});
console.log(`PASS: Passing–Bablok ${tests.length} groups / 21 R mcr synthetic cases, cusum hand check, pinned R package hashes.`);
