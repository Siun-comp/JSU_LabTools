import {calculate,convert,prepare,format,unitsFor,MOLAR_UNITS,MASS_UNITS,MOLAR_AMOUNT_UNITS,MASS_AMOUNT_UNITS,VOLUME_UNITS} from './core.mjs';
import {clipboardData,conversionClipboard,preparationClipboard} from './clipboard.mjs';
const $=id=>document.getElementById(id);
const form=$('dilution-form'); let result=null, revision=0;
function mode(){return form.elements.mode.value;}
function populateUnits(){
  const family=$('family').value, units=unitsFor(family);
  for(const id of ['stock-unit','target-unit']) {
    const select=$(id); select.replaceChildren();
    for(const unit of units){const option=document.createElement('option');option.value=unit;option.textContent=unit;select.append(option);}
    select.value=family==='mass'?'ng/µL':family==='mixed'?(id==='stock-unit'?'M':'mg/mL'):id==='stock-unit'?'M':'mM';
  }
}
function mwHelp(){
  const cross=MOLAR_UNITS.includes($('stock-unit').value)!==MOLAR_UNITS.includes($('target-unit').value);
  $('mw-field').hidden=!cross; $('molecular-weight').disabled=!cross;
}
function modeHelp(){
  $('volume-label').textContent=mode()==='final'?'최종 부피':'보유 Stock 부피';
  $('volume-help').textContent=mode()==='final'?'Stock과 희석액을 합친 최종 전체 부피입니다.':'목표 농도로 희석할 Stock의 전체 보유량입니다.';
}
function invalidate(message='입력 조건이 바뀌었습니다. 다시 계산하세요.') {
  revision++; result=null; $('results').hidden=true; $('result-body').replaceChildren();
  $('result-basis').textContent=''; $('dilution-factor').textContent=''; $('preparation').textContent='';
  $('mw-basis').textContent='';
  $('copy').disabled=true; $('copy-status').textContent=''; $('empty-result').hidden=false;
  $('empty-result').textContent=message; $('message').textContent='';
}
form.addEventListener('input',()=>invalidate());
form.addEventListener('change',e=>{if(e.target.id==='family')populateUnits();modeHelp();mwHelp();invalidate();});
form.addEventListener('submit',e=>{
  e.preventDefault(); invalidate('입력 조건을 확인하세요.');
  try {
    const r=calculate({mode:mode(),family:$('family').value,stock:$('stock').value,stockUnit:$('stock-unit').value,target:$('target').value,targetUnit:$('target-unit').value,volume:$('volume').value,volumeUnit:$('volume-unit').value,molecularWeight:$('molecular-weight').value});
    const i=r.input;
    $('result-basis').textContent=i.stock+' '+i.stockUnit+' → '+i.target+' '+i.targetUnit;
    if(r.mw)$('mw-basis').textContent='분자량 '+i.molecularWeight+' g/mol · 환산 Stock '+format(r.normalizedStock)+' / 목표 '+format(r.normalizedTarget)+' mol/L';
    for(const [label,value] of [['Stock 사용량',r.stockVolume],['희석액 추가량 (이론)',r.diluentVolume],['최종 부피',r.finalVolume]]){
      const tr=document.createElement('tr');
      for(const text of [label,format(value),i.volumeUnit]){const td=document.createElement('td');td.textContent=text;tr.append(td);}
      $('result-body').append(tr);
    }
    $('dilution-factor').textContent=format(r.factor)+'배 희석';
    $('preparation').textContent='Stock '+format(r.stockVolume)+' '+i.volumeUnit+'를 사용하여 희석액으로 최종 '+format(r.finalVolume)+' '+i.volumeUnit+'까지 맞춥니다.';
    result=r; $('empty-result').hidden=true; $('results').hidden=false; $('copy').disabled=false;
  } catch(error) {$('message').textContent=error.message; $('empty-result').textContent='입력 조건을 확인한 뒤 다시 계산하세요.';}
});
$('clear').addEventListener('click',()=>{
  for(const id of ['stock','target','volume','molecular-weight'])$(id).value='';
  invalidate('조건을 입력하고 ‘희석 계산’을 누르세요.'); $('stock').focus();
});
$('copy').addEventListener('click',async()=>{
  if(!result)return;
  const token=revision,data=clipboardData(result); $('copy').disabled=true; $('copy-status').textContent='복사 중…';
  try {
    const html=await writeClipboard(data);
    $('copy-status').textContent=token===revision?(html?'복사했습니다. 입력 조건·결과·방법을 포함한 3열 표입니다.':'일반 텍스트로 복사했습니다. 글꼴 서식은 포함되지 않습니다.'):'복사 중 조건이 바뀌었습니다. 이전 조건이 복사되었으므로 다시 계산·복사하세요.';
  }catch{$('copy-status').textContent='복사하지 못했습니다. 브라우저의 클립보드 권한을 확인하세요.';}
  finally{if(token===revision && result)$('copy').disabled=false;}
});
async function writeClipboard(data){
  if(typeof ClipboardItem!=='undefined' && navigator.clipboard?.write){
    try{await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([data.text],{type:'text/plain'}),'text/html':new Blob([data.html],{type:'text/html'})})]);return true;}
    catch{await navigator.clipboard.writeText(data.text);return false;}
  }
  await navigator.clipboard.writeText(data.text);return false;
}
const conversionForm=$('conversion-form'),dialog=$('conversion-dialog');let conversionResult=null,conversionRevision=0;
function conversionUnits(){
  const amount=$('conversion-kind').value==='amount',toMass=$('conversion-direction').value==='molar-to-mass';
  const molar=amount?MOLAR_AMOUNT_UNITS:MOLAR_UNITS,mass=amount?MASS_AMOUNT_UNITS:MASS_UNITS;
  for(const [id,units] of [['conversion-input-unit',toMass?molar:mass],['conversion-output-unit',toMass?mass:molar]]){
    const select=$(id);select.replaceChildren();
    for(const unit of units){const option=document.createElement('option');option.value=unit;option.textContent=unit;select.append(option);}
    select.value=units===mass?(amount?'g':'mg/mL'):(amount?'mol':'M');
  }
}
function invalidateConversion(){
  conversionRevision++;conversionResult=null;$('conversion-result').hidden=true;$('conversion-result-value').textContent='';$('conversion-result-basis').textContent='';$('conversion-error').textContent='';$('conversion-copy').disabled=true;$('conversion-copy-status').textContent='';
}
$('open-conversion').addEventListener('click',()=>{dialog.showModal();$('conversion-value').focus();});
$('close-conversion').addEventListener('click',()=>dialog.close());
conversionForm.addEventListener('input',invalidateConversion);
conversionForm.addEventListener('change',e=>{if(['conversion-kind','conversion-direction'].includes(e.target.id))conversionUnits();invalidateConversion();});
conversionForm.addEventListener('submit',e=>{
  e.preventDefault();invalidateConversion();
  try{
    const r=convert({kind:$('conversion-kind').value,direction:$('conversion-direction').value,value:$('conversion-value').value,inputUnit:$('conversion-input-unit').value,outputUnit:$('conversion-output-unit').value,molecularWeight:$('conversion-mw').value});
    conversionResult=r;$('conversion-result-value').textContent=format(r.value)+' '+r.input.outputUnit;
    $('conversion-result-basis').textContent=(r.input.kind==='amount'?'총량':'농도')+' · 입력 '+r.input.value+' '+r.input.inputUnit+' · 직접 입력 분자량 '+r.input.molecularWeight+' g/mol';
    $('conversion-result').hidden=false;$('conversion-copy').disabled=false;
  }catch(error){$('conversion-error').textContent=error.message;}
});
$('conversion-clear').addEventListener('click',()=>{$('conversion-value').value='';$('conversion-mw').value='';invalidateConversion();$('conversion-value').focus();});
$('conversion-copy').addEventListener('click',async()=>{
  if(!conversionResult)return;const token=conversionRevision,data=conversionClipboard(conversionResult);$('conversion-copy').disabled=true;$('conversion-copy-status').textContent='복사 중…';
  try{const html=await writeClipboard(data);$('conversion-copy-status').textContent=token!==conversionRevision?'복사 중 조건이 바뀌었습니다. 다시 환산·복사하세요.':html?'복사했습니다. 입력·분자량·결과·방법을 포함한 3열 표입니다.':'일반 텍스트로 복사했습니다. 글꼴 서식은 포함되지 않습니다.';}
  catch{$('conversion-copy-status').textContent='복사하지 못했습니다. 브라우저의 클립보드 권한을 확인하세요.';}
  finally{if(token===conversionRevision&&conversionResult)$('conversion-copy').disabled=false;}
});
populateUnits();modeHelp();mwHelp();conversionUnits();
const prepForm=$('prep-form'),prepDialog=$('preparation-dialog');let prepResult=null,prepRevision=0;
function prepUnits(){
  const mass=$('prep-mode').value==='mass';
  $('prep-known-label').textContent=mass?'최종 부피':'보유 시약 질량';
  $('prep-known-help').textContent=mass?'용해 후 맞추려는 용액 전체 부피입니다.':'보유 질량 전체를 사용하여 목표 몰농도로 조제합니다.';
  for(const [id,units,initial] of [['prep-known-unit',mass?VOLUME_UNITS:MASS_AMOUNT_UNITS,mass?'mL':'g'],['prep-output-unit',mass?MASS_AMOUNT_UNITS:VOLUME_UNITS,mass?'g':'mL']]){
    const select=$(id);select.replaceChildren();for(const unit of units){const option=document.createElement('option');option.value=unit;option.textContent=unit;select.append(option);}select.value=initial;
  }
  $('prep-output-label').textContent=mass?'필요 질량의 표시 단위':'최종 부피의 표시 단위';
}
function invalidatePrep(){prepRevision++;prepResult=null;$('prep-result').hidden=true;$('prep-result-value').textContent='';$('prep-result-basis').textContent='';$('prep-instruction').textContent='';$('prep-error').textContent='';$('prep-copy').disabled=true;$('prep-copy-status').textContent='';}
$('open-preparation').addEventListener('click',()=>{prepDialog.showModal();$('prep-concentration').focus();});
$('close-preparation').addEventListener('click',()=>prepDialog.close());
prepForm.addEventListener('input',invalidatePrep);
prepForm.addEventListener('change',e=>{if(e.target.id==='prep-mode')prepUnits();invalidatePrep();});
prepForm.addEventListener('submit',e=>{
  e.preventDefault();invalidatePrep();
  try{
    const r=prepare({mode:$('prep-mode').value,concentration:$('prep-concentration').value,concentrationUnit:$('prep-concentration-unit').value,molecularWeight:$('prep-mw').value,known:$('prep-known').value,knownUnit:$('prep-known-unit').value,outputUnit:$('prep-output-unit').value});
    const i=r.input,mass=i.mode==='mass';prepResult=r;
    $('prep-result-label').textContent=mass?'필요한 시약 질량':'맞출 최종 부피';
    $('prep-result-value').textContent=format(r.value)+' '+i.outputUnit;
    $('prep-result-basis').textContent='목표 '+i.concentration+' '+i.concentrationUnit+' · MW '+i.molecularWeight+' g/mol';
    $('prep-instruction').textContent=mass?'시약 '+format(r.value)+' '+i.outputUnit+'을 용해한 뒤 용매로 최종 '+i.known+' '+i.knownUnit+'까지 맞추세요.':'보유 시약 '+i.known+' '+i.knownUnit+' 전체를 용해한 뒤 용매로 최종 '+format(r.value)+' '+i.outputUnit+'까지 맞추세요.';
    $('prep-result').hidden=false;$('prep-copy').disabled=false;
  }catch(error){$('prep-error').textContent=error.message;}
});
$('prep-clear').addEventListener('click',()=>{for(const id of ['prep-concentration','prep-mw','prep-known'])$(id).value='';invalidatePrep();$('prep-concentration').focus();});
$('prep-copy').addEventListener('click',async()=>{
  if(!prepResult)return;const token=prepRevision,data=preparationClipboard(prepResult);$('prep-copy').disabled=true;$('prep-copy-status').textContent='복사 중…';
  try{const html=await writeClipboard(data);$('prep-copy-status').textContent=token!==prepRevision?'복사 중 조건이 바뀌었습니다. 다시 계산·복사하세요.':html?'복사했습니다. 조제 조건·결과·방법을 포함한 3열 표입니다.':'일반 텍스트로 복사했습니다. 글꼴 서식은 포함되지 않습니다.';}
  catch{$('prep-copy-status').textContent='복사하지 못했습니다. 브라우저의 클립보드 권한을 확인하세요.';}
  finally{if(token===prepRevision&&prepResult)$('prep-copy').disabled=false;}
});
prepUnits();
