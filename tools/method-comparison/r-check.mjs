// Optional in-browser R cross-check. Runs only when the user presses the button.
// webR 0.6.0 (R 4.6.0) is loaded from the official webR site; mcr and its dependencies are fixed
// official R-wasm binaries served next to this tool and checked by SHA-256 before use.
// Input values stay in this browser (the webR worker); nothing is sent to a server.
export const R_RUNTIME={webR:'0.6.0',r:'4.6.0',baseUrl:'https://webr.r-wasm.org/v0.6.0/'};
export const R_PACKAGES=Object.freeze([
 {name:'Rcpp',version:'1.1.2',sha256:'87746dcb2b15bb70f944a9585287d5e2876fc7dcb120473d2cb27b9a2ed410b4',metadataSHA256:'aaf0b0c9c1c174e499fbee78199e967624a2c597320c57dcc53f161f8c60abf0'},
 {name:'robslopes',version:'1.1.4',sha256:'62b7480ccd55dfbbdd7376aa7568aa7045852080f46cd15b1ba3a8d7660b8d8a',metadataSHA256:'c195c80a93ee6f88c7dad9024b7c2204d9320d76122725e8d6b108177d84e680'},
 {name:'mcr',version:'1.3.3.1',sha256:'c89f3d54ec744c5b4056ca896603a56dd5aee22a66a73df7693d82efb46b7495',metadataSHA256:'d5271027e6f5a93cabc89cd4a839964b5f5da9c599ee19278ca3ac67c684e295'}]);
export const R_SOURCE='https://repo.r-wasm.org/bin/emscripten/contrib/4.6/';
// Relative difference at or below this is shown as "일치" (floating-point rounding only).
export const MATCH_TOLERANCE=1e-9;
const LIB='/jsu-method-comparison-library';
let session=null;
async function sha256(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
async function fixedPackage(r,pkg,progress){
 const file=n=>new URL(`./runtime/${pkg.name}_${pkg.version}.${n}`,import.meta.url);
 progress(`R 패키지 확인 중: ${pkg.name} ${pkg.version}`);
 const [binary,index]=await Promise.all(['tgz','metadata.json'].map(async n=>{const res=await fetch(file(n),{credentials:'omit',referrerPolicy:'no-referrer'});if(!res.ok)throw Error('package_unavailable');return new Uint8Array(await res.arrayBuffer());}));
 if(await sha256(binary)!==pkg.sha256||await sha256(index)!==pkg.metadataSHA256)throw Error('package_integrity_mismatch');
 const metadata=JSON.parse(new TextDecoder().decode(index));
 const bytes=await new Response(new Blob([binary]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 if(!Array.isArray(metadata.files)||!metadata.files.every(f=>typeof f.filename==='string'&&f.filename.startsWith('/')&&!f.filename.split('/').includes('..')&&Number.isSafeInteger(f.start)&&Number.isSafeInteger(f.end)&&f.start>=0&&f.start<=f.end&&f.end<=bytes.byteLength))throw Error('package_integrity_mismatch');
 await r.FS.mkdir(`${LIB}/${pkg.name}`);
 await r.FS.mount('WORKERFS',{packages:[{blob:new Blob([bytes]),metadata}]},`${LIB}/${pkg.name}`);
}
async function ready(progress){
 if(session)return session;
 progress('브라우저 R 환경 준비 중… (처음 한 번 내려받기)');
 const mod=await import(R_RUNTIME.baseUrl+'webr.mjs');
 const r=new mod.WebR({baseUrl:R_RUNTIME.baseUrl,channelType:mod.ChannelType.PostMessage});await r.init();
 const rVersion=await r.evalRString('as.character(getRversion())');
 if(r.version!==R_RUNTIME.webR||rVersion!==R_RUNTIME.r)throw Error('runtime_version_mismatch');
 await r.FS.mkdir(LIB);
 for(const pkg of R_PACKAGES)await fixedPackage(r,pkg,progress);
 await r.evalRVoid(`.libPaths(c("${LIB}",.libPaths()))`);
 for(const pkg of R_PACKAGES){const v=await r.evalRString(`as.character(packageVersion("${pkg.name}"))`);if(v!==pkg.version)throw Error('runtime_version_mismatch');}
 await r.evalRVoid('suppressPackageStartupMessages(library(mcr))');
 session={r,environment:{webR:r.version,r:rVersion,packages:R_PACKAGES.map(p=>`${p.name} ${p.version}`).join(', ')}};
 return session;
}
// R code: mcr's own estimates. Deming CI is rebuilt from mcr's jackknife SE with t(n−1), the
// interval this tool reports; mcr's default Deming CI (t(n−2)) is returned as a separate reference.
const CODE=`local({
 a <- 1 - level; n <- length(x); out <- rep(NA_real_, 20)
 l <- getCoefficients(mcreg(x, y, method.reg = "LinReg", method.ci = "analytical", alpha = a))
 out[1:6] <- c(l[2, 1], l[2, 3], l[2, 4], l[1, 1], l[1, 3], l[1, 4])
 if (lambda > 0) {
  d <- getCoefficients(mcreg(x, y, method.reg = "Deming", method.ci = "jackknife", error.ratio = 1 / lambda, alpha = a))
  t1 <- qt(1 - a / 2, n - 1)
  out[7:14] <- c(d[2, 1], d[2, 2], d[2, 1] - t1 * d[2, 2], d[2, 1] + t1 * d[2, 2], d[1, 1], d[1, 2], d[1, 1] - t1 * d[1, 2], d[1, 1] + t1 * d[1, 2])
  out[19:20] <- c(d[2, 3], d[2, 4])
 }
 if (min(c(x, y)) >= 0) {
  p <- getCoefficients(mcreg(x, y, method.reg = "PaBa", method.ci = "analytical", alpha = a))
  out[15:18] <- c(p[2, 1], p[2, 3], p[2, 4], p[1, 1])
  out <- c(out, p[1, 3], p[1, 4])
 } else out <- c(out, NA_real_, NA_real_)
 out
})`;
export async function runRCheck({x,y,level,lambda},progress=()=>{}){
 if(!(x.length===y.length&&x.length>=3))throw Error('input_blocked');
 const s=await ready(progress);progress('R(mcr)로 계산 중…');
 const shelter=await new s.r.Shelter();
 try{
  const res=await shelter.captureR(CODE,{env:{x,y,level,lambda:lambda>0?lambda:0}});
  const out=await res.result.toArray();
  // NA → null; ±Inf (a CI bound mcr could not set) is kept as ±Infinity.
  const v=i=>{const n=out[i];return typeof n==='number'&&!Number.isNaN(n)?n:null;};
  return {environment:s.environment,ols:{slope:v(0),slopeCI:[v(1),v(2)],intercept:v(3),interceptCI:[v(4),v(5)]},
   deming:lambda>0?{slope:v(6),slopeSE:v(7),slopeCI:[v(8),v(9)],intercept:v(10),interceptSE:v(11),interceptCI:[v(12),v(13)],mcrDefaultSlopeCI:[v(18),v(19)]}:null,
   pb:v(14)===null?null:{slope:v(14),slopeCI:[v(15),v(16)],intercept:v(17),interceptCI:[v(20),v(21)]}};
 }finally{shelter.purge();}
}
export function relativeDifference(a,b){
 if(a===b)return 0; // includes matching ±Infinity
 if(a===null||b===null||a===undefined||b===undefined||!Number.isFinite(a)||!Number.isFinite(b))return null;
 return Math.abs(a-b)/Math.max(1,Math.abs(a),Math.abs(b));
}
