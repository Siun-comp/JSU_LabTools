import {calculate,format,units,MASS_UNITS,MOLAR_UNITS,COPY_UNITS} from './core.mjs';
import {clipboardData} from './clipboard.mjs';
import {copyScientific} from './math.mjs';
import {VECTOR_DATA,vectorInput,vectorProvenance} from './vectors.mjs';
const $=id=>document.getElementById(id);
function setText(id,value){$(id).textContent=String(value).replace(/\.[ \t]+(?=\S)/g,'.\n');}
let result=null,revision=0,loadedVector=null,vectorUndo=null;
function options(id,entries,value){const s=$(id);s.replaceChildren();for(const [v,label] of entries){const o=document.createElement('option');o.value=v;o.textContent=label;s.append(o);}s.value=entries.some(([v])=>v===value)?value:entries[0][0];}
function invalidate(message='입력 조건이 바뀌었습니다. 다시 계산하세요.'){revision++;result=null;$('results').hidden=true;$('empty-result').hidden=false;$('result-body').replaceChildren();setText('basis','');setText('mw-result','');setText('mw-method-note','');setText('conversion-note','');setText('sequence-summary','');setText('vector-summary','');setText('copy-format-note','');$('copy').disabled=true;setText('copy-status','');setText('message',message);}
function sync(){const t=$('molecule').value,m=$('method').value,rna=t==='ssRNA',single=t==='ssDNA'||rna;
 $('average-fields').hidden=m!=='average';$('direct-fields').hidden=m!=='direct';$('sequence-fields').hidden=m!=='sequence';
 setText('length-label','전체 길이 ('+(single?'nt':'bp')+')');
 const list=single?(rna?[['340','340n · Promega RNA'],['320.5','320.5n+159 · Thermo/Ambion 자료']]:[['330','330n · Promega ssDNA'],['303.7','303.7n+79 · Thermo/Ambion 자료']]):[['neb-web','NEBioCalculator · 615.94n+36.04'],['thermo-web','Thermo Copy Calculator · 기본650'],['650','650n · 일반 근사 (기존650)'],['660','660n · Promega 자료'],['607.4','607.4n+157.9 · Thermo/Ambion 자료']];
 options('coefficient',[['','선택하세요'],...list],$('coefficient').value);
 const c=$('coefficient').value,terminal={'303.7':'79.0','320.5':'159.0','607.4':'157.9'}[c];
 setText('average-help',c==='neb-web'?'NEBioCalculator dsDNA 길이 모드: MW = 전체 bp × 615.94 + 36.04 g/mol. NA = 6.022E23. 확인 v1.17.5 / 2026-10-06. 서열 입력 모드는 별도이며 구조·말단을 자동 변경하지 않습니다. Plasmid는 전체 분자 길이를 사용하세요.':c==='thermo-web'?'Thermo DNA Copy Number Calculator 기본값: MW = 전체 bp × 650 g/mol. NA = 6.022E23. 질량농도 입력에서는 웹툴처럼 copies/ng를 먼저 정수 반올림합니다. 몰/Copy 입력은 해당 기준의 역환산이며 웹 화면 재현 범위 밖입니다. Plasmid는 전체 분자 길이를 사용하세요.':terminal?'Thermo Fisher/Ambion 기술자료: MW = 전체 길이 × '+c+' + '+terminal+' g/mol. '+
 (rna?'5′ 삼인산을 포함한 RNA의 공식 고정 근사식입니다.':single?'5′ 인산1개를 포함한 ssDNA의 공식 고정 근사식입니다.':'dsDNA의 공식 고정 근사식이며 말단 상수를 포함합니다. 완전 폐환 Plasmid 전용식이 아니며 실제 구조에 맞춰 말단을 자동 변경하지 않습니다.')+
 ' Thermo Copy Calculator 기본식과는 다른 자료 기준입니다. 다른 말단·구조를 반영하려면 지원 조건의 일반 서열법이나 해당 전체 MW를 선택하세요. Plasmid는 전체 분자 길이를 사용하세요.':
 '길이에 평균 계수를 곱하는 기존 근사값입니다. NA = 6.02214076E23. 실제 NEBioCalculator 또는 Thermo Copy Calculator의 계산 기준과 구별하세요. Plasmid는 insert가 아닌 전체 Plasmid 길이를 사용하세요.');
 options('topology',[['','선택하세요'],['linear','선형'],...(!rna?[['circular','완전 폐환 원형']]:[])],$('topology').value);
 const circular=$('topology').value==='circular';
 $('ends-field').hidden=circular;$('ends-guide').hidden=circular;
 setText('ends-label',single?'시료의 말단 조건':'두 가닥 각각의 말단 조건');
 setText('ends-help',circular?'완전 폐환은 가닥 끝이 없는 조건입니다. Vector 이름이나 원형 서열 파일만으로 실제 시료의 폐환 상태를 확정할 수 없습니다.':
 (rna?'일반 화학 합성 RNA·5′ 인산화 주문 없음 → OH. 5′ 인산1개로 주문·처리한 RNA → 인산1개. IVT RNA는 아래 안내를 확인하세요.':
 '일반 합성 올리고·인산화하지 않은 프라이머의 PCR 산물 → OH. 5′ 인산화 주문·처리 시료 → 인산1개.')+
 (single?'':' 이중가닥은 두 가닥 모두 같은 말단 상태인 경우만 적용합니다.'));
 setText('ends-oh-example',rna?'OH: 수정 없이 화학 합성한 RNA는 보통 5′ OH/3′ OH입니다. 5′ 인산화는 별도 주문·처리 조건입니다.':
 'OH: 수정 없이 합성한 DNA 올리고는 보통 5′ OH/3′ OH입니다. PCR은 프라이머의 3′ 쪽을 늘리므로 5′ 말단은 프라이머의 상태를 이어받습니다. 두 프라이머 모두 5′ 인산화하지 않았다면 산물의 5′ 말단도 OH입니다.');
 setText('ends-p-example',rna?'인산1개: 5′ 인산화 옵션으로 주문했거나, T4 PNK+ATP 등으로 5′ 인산화가 완료된 RNA가 해당합니다. 삼인산·cap과는 다릅니다.':
 '인산1개: 5′ 인산화 옵션(/5Phos/)으로 주문한 올리고, 두 프라이머 모두 5′ 인산화한 PCR 산물, 또는 T4 PNK+ATP 등으로 5′ 인산화가 완료된 시료가 해당합니다. 처리 이력과 실제 말단을 확인하세요.');
 $('ends-dna-example').hidden=rna;$('ends-rna-example').hidden=!rna;
 $('vector-fields').hidden=m!=='sequence'||t!=='Plasmid';vectorStatus();
}
function vectorStatus(){const v=VECTOR_DATA.vectors.find(v=>v.id===$('vector').value);$('load-vector').disabled=!v?.available;$('undo-vector').disabled=!vectorUndo;setText('vector-status',v?v.name+' · 공개 파일 '+v.length+' bp · '+(v.reason||'선택 후 불러오기 버튼을 누르세요.'):'기본 Vector는 선택 사항입니다.');const p=vectorProvenance(loadedVector,$('sequence').value);setText('vector-origin',p?p.name+' · '+p.state+' · 자료 v'+p.dataVersion+' / 확인 '+p.checked:'');}
function input(){return {type:$('molecule').value,kind:$('kind').value,unit:$('input-unit').value,value:$('value').value,method:$('method').value,length:$('length').value,coefficient:$('coefficient').value,mw:$('mw').value,source:$('source').value,sequence:$('sequence').value,vector:$('method').value==='sequence'&&$('molecule').value==='Plasmid'?vectorProvenance(loadedVector,$('sequence').value):null,topology:$('topology').value,ends:$('ends').value,massUnit:$('mass-unit').value,molarUnit:$('molar-unit').value,copyUnit:$('copy-unit').value};}
function render(r){$('empty-result').hidden=true;$('results').hidden=false;setText('basis',r.webReference?r.webReference.name+' · MW = '+r.webReference.formula+' g/mol':r.basis);setText('mw-result',r.mw?'MW '+format(r.mw)+' g/mol'+(r.input.source?' · 출처: '+r.input.source:''):'MW 없음 · 계산 가능한 항목만 표시');
 setText('mw-method-note',r.mw?'질량농도가 포함된 환산은 MW 기준에 따라 달라집니다. 같은 시료의 조제·기록에는 동일한 기준을 사용하세요.'+(r.input.method==='sequence'?' 서열법의 무수 유리산 기준과 길이 평균법은 계산 기준이 다릅니다.':''):'');
 setText('conversion-note',r.webReference?'환산 기준: NA '+r.conversion.avogadro+' mol⁻¹ · '+r.conversion.rounding+'. '+r.conversion.scope+'. 앱의 주값은 최대12유효숫자로 표시합니다.':'');
 setText('sequence-summary',r.seq?'계산 길이 '+r.length+' '+(r.input.type==='ssRNA'||r.input.type==='ssDNA'?'nt':'bp')+' · '+r.seq.formatNote+(r.seq.header?' · FASTA: '+r.seq.header:''):r.length?'전체 길이 '+r.length+' '+(r.input.type==='ssRNA'||r.input.type==='ssDNA'?'nt':'bp'):'');
 for(const [name,value,unit] of [['질량농도',r.mass,r.input.massUnit],['몰농도',r.molar,r.input.molarUnit],['Copy 농도',r.copies,r.input.copyUnit]]){const tr=document.createElement('tr');for(const text of [name,value?format(value):'분자량 필요',unit]){const td=document.createElement('td');td.textContent=text;tr.append(td);}const sci=name==='Copy 농도'?copyScientific(value):null;if(sci){const small=document.createElement('small');small.className='scientific-copy';small.textContent='지수 '+sci;tr.children[1].append(small);}$('result-body').append(tr);}
 setText('copy-format-note',copyScientific(r.copies)?'지수 표기는 소수 두 자리·3유효숫자 요약입니다. 위의 원래 값과 계산 정밀도는 유지합니다.':'');
 const v=r.input.vector;setText('vector-summary',v?'Vector 출처: '+v.name+' · '+v.state+' · 자료 v'+v.dataVersion+' · 선택한 구조는 사용자가 지정한 계산 조건입니다.':'');
 $('copy').disabled=false;setText('message','');}
$('calc-form').addEventListener('input',()=>invalidate('입력 조건이 바뀌었습니다. 다시 계산하세요.'));
$('calc-form').addEventListener('change',()=>invalidate('입력 조건이 바뀌었습니다. 다시 계산하세요.'));
for(const id of ['molecule','method','topology','coefficient'])$(id).addEventListener('change',sync);
$('kind').addEventListener('change',()=>{const kind=$('kind').value;options('input-unit',units(kind).map(s=>[s,s]),kind==='mass'?'ng/µL':kind==='molar'?'nM':'copies/µL');});
$('calc-form').addEventListener('submit',e=>{e.preventDefault();invalidate('');try{result=calculate(input());render(result);}catch(error){setText('message',error.message);}});
$('vector').addEventListener('change',vectorStatus);$('sequence').addEventListener('input',vectorStatus);
$('load-vector').addEventListener('click',()=>{try{const next=vectorInput($('vector').value);vectorUndo={raw:$('sequence').value,loaded:loadedVector};loadedVector=next;$('sequence').value=next.raw;invalidate('기본 Vector 서열을 불러왔습니다. insert 포함 여부와 실제 구조·말단을 확인한 뒤 계산하세요.');vectorStatus();$('sequence').focus();}catch(error){invalidate(error.message);}});
$('undo-vector').addEventListener('click',()=>{if(!vectorUndo)return;$('sequence').value=vectorUndo.raw;loadedVector=vectorUndo.loaded;vectorUndo=null;invalidate('불러오기 전 입력으로 되돌렸습니다. 다시 계산하세요.');vectorStatus();$('sequence').focus();});
$('clear').addEventListener('click',()=>{$('calc-form').reset();loadedVector=null;vectorUndo=null;initialUnits();sync();invalidate('');$('value').focus();});
$('copy').addEventListener('click',async()=>{if(!result)return;const before=revision,data=clipboardData(result);$('copy').disabled=true;try{
 if(typeof ClipboardItem!=='undefined'&&navigator.clipboard?.write)await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([data.text],{type:'text/plain'}),'text/html':new Blob([data.html],{type:'text/html'})})]);
 else if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(data.text);else throw Error('클립보드를 사용할 수 없습니다. 보안 연결에서 실행하세요.');
 setText('copy-status',before===revision?'조건·결과를 복사했습니다. Excel에 붙여넣으세요.':'복사 중 조건이 바뀌었습니다. 클립보드에는 이전 조건의 결과가 있습니다. 다시 계산·복사하세요.');
 }catch(error){setText('copy-status',before===revision?'복사하지 못했습니다. '+error.message:'복사 중 조건이 바뀌었으며 복사를 완료하지 못했습니다. 다시 계산·복사하세요.');}finally{if(before===revision&&result)$('copy').disabled=false;}});
function initialUnits(){options('input-unit',MASS_UNITS.map(s=>[s,s]),'ng/µL');options('mass-unit',MASS_UNITS.map(s=>[s,s]),'ng/µL');options('molar-unit',MOLAR_UNITS.map(s=>[s,s]),'nM');options('copy-unit',COPY_UNITS.map(s=>[s,s]),'copies/µL');}
options('vector',[['','직접 입력 · 기본 Vector 선택 안 함'],...VECTOR_DATA.vectors.map(v=>[v.id,v.name+' · '+v.length+' bp'+(!v.available?' · 사용 불가 (모호염기 S)':'')])],'');for(const o of $('vector').options){const v=VECTOR_DATA.vectors.find(v=>v.id===o.value);if(v&&!v.available)o.disabled=true;}
initialUnits();sync();invalidate('');
