/* D-031 shared webR transport/lifecycle. Task adapters retain existing methods. */
'use strict';
(function(root){
 const baseUrl='https://webr.r-wasm.org/v0.6.0/';
 function create(options={}){
  let modulePromise=null,importAttempt=0,session=null,active=null;
  const load=options.loadRuntime||(()=>modulePromise||(modulePromise=import(baseUrl+'webr.mjs'+(importAttempt++?'?mdc-retry='+importAttempt:'')).catch(error=>{modulePromise=null;throw error;})));
  function dispose(s){if(!s)return;s.closed=true;if(session===s)session=null;try{Promise.resolve(s.r?.close()).catch(()=>{});}catch{}}
  function run(task,query,{signal,onProgress=()=>{},startupTimeoutMs=60000,calculationTimeoutMs=20000}={}){
   if(!task.validate(query))return Promise.reject(Error('input_blocked'));
   if(signal?.aborted)return Promise.reject(Error('aborted'));if(active)return Promise.reject(Error('busy'));
   const q=structuredClone(query),s=session||(session={r:null,ready:false,closed:false}),job={};active=job;
   const applicationVersion=root.AppRelease?.version||'unavailable';
   return new Promise((resolve,reject)=>{
    let timer,done=false;
    const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);if(active===job)active=null;if(error)dispose(s);error?reject(error):resolve(value);};
    const abort=()=>finish(Error('aborted'));
    const check=()=>{if(done||s.closed||active!==job)throw Error('aborted');};
    const progress=text=>{check();onProgress(text);};
    const deadline=(ms,code)=>{clearTimeout(timer);timer=setTimeout(()=>finish(Error(code)),ms);};
    signal?.addEventListener('abort',abort,{once:true});deadline(startupTimeoutMs,'startup_timeout');
    (async()=>{
     if(!s.ready){
      progress('브라우저 R 환경 준비 중…');const mod=await load();check();s.r=new mod.WebR({baseUrl,channelType:mod.ChannelType.PostMessage});
      // A cross-origin worker can be created after early close() was a no-op.
      const initialized=s.r.init();initialized.then(()=>{if(s.closed)dispose(s);},()=>{if(s.closed)dispose(s);});await initialized;check();
      s.env={executionRuntime:'browser-webR',webRVersion:s.r.version,channelType:'PostMessage',rVersion:await s.r.evalRString('as.character(getRversion())'),statsVersion:await s.r.evalRString('as.character(packageVersion("stats"))')};check();
      if(s.env.webRVersion!=='0.6.0'||s.env.rVersion!=='4.6.0'||s.env.statsVersion!=='4.6.0')throw Error('runtime_version_mismatch');s.ready=true;
     }
     if(task.needsMASS&&!s.massVersion){
      if(!await s.r.evalRBoolean('requireNamespace("MASS",quietly=TRUE)')){progress('CI 계산 라이브러리 준비 중…');await s.r.installPackages(['MASS']);check();}
      s.massVersion=await s.r.evalRString('as.character(packageVersion("MASS"))');check();if(s.massVersion!=='7.3.65')throw Error('runtime_version_mismatch');
     }
     check();deadline(calculationTimeoutMs,'calculation_timeout');progress(task.label+' 계산 중…');await s.r.flush();check();
     await s.r.FS.writeFile('/mdc-input.txt',new TextEncoder().encode(task.encode(q)));check();
     const output=await s.r.evalRString(task.source.program);check();const messages=await s.r.flush();check();
     const environment={rVersion:s.env.rVersion,statsVersion:s.env.statsVersion,executionRuntime:s.env.executionRuntime,webRVersion:s.env.webRVersion,channelType:s.env.channelType,...(task.needsMASS?{massVersion:s.massVersion}:{}),sourceSHA256:task.source.sha256,applicationVersion};
     finish(null,task.decode(output,q,environment,messages.some(m=>m.type==='stderr'&&String(m.data).trim())));
    })().catch(error=>finish(error));
   });
  }
  return {run,state:()=>({busy:!!active,ready:!!session?.ready})};
 }
 function message(error){return ({busy:'다른 분석이 실행 중입니다. 완료하거나 해당 분석에서 취소한 후 다시 실행하세요.',input_blocked:'계산 입력의 형식·지원 범위를 확인하세요.',invalid_response:'계산 응답을 검증하지 못했습니다.',runtime_version_mismatch:'검증한 계산 환경 버전과 달라 계산을 차단했습니다.',startup_timeout:'계산 환경 준비 제한시간(60초)을 초과했습니다. 네트워크 연결을 확인하고 다시 실행하세요.',calculation_timeout:'계산 제한시간(20초)을 초과했습니다. 다시 실행하세요.',aborted:'계산을 취소했습니다.',execution_failed:'계산에 실패했습니다. 입력 수치 범위를 확인하세요. 데이터를 임의로 제외하지 않습니다.'})[error.message]||'브라우저 계산 환경을 준비하거나 실행하지 못했습니다. 네트워크 연결을 확인하고 다시 실행하세요.';}
 const api={create,message};if(typeof module==='object'&&module.exports)module.exports=api;else root.BrowserRRuntime={...api,shared:create()};
})(globalThis);
