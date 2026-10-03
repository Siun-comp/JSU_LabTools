/* Transport validation of a display-only R prediction grid, not model fitting. */
(function(root){'use strict';
 function valid(curve,concentrations){if(!curve||curve.version!=='probit-curve-1'||curve.method!=='stats::predict.glm(type=response,se.fit=FALSE)'||curve.grid!=='log10-even-201'||!Array.isArray(curve.logConcentration)||!Array.isArray(curve.probability)||curve.logConcentration.length!==201||curve.probability.length!==201)return false;
 const lo=Math.log10(Math.min(...concentrations)),hi=Math.log10(Math.max(...concentrations));if(!Number.isFinite(lo)||!Number.isFinite(hi)||hi<=lo)return false;
 return curve.logConcentration.every((x,i)=>Number.isFinite(x)&&Math.abs(x-(lo+(hi-lo)*i/200))<=1e-12*Math.max(1,Math.abs(x))&&(i===0||x>curve.logConcentration[i-1]))&&curve.probability.every((p,i)=>Number.isFinite(p)&&p>=0&&p<=1&&(i===0||p>=curve.probability[i-1]));}
 const api={valid};if(typeof module==='object'&&module.exports)module.exports=api;else root.LoDCurveContract=api;
})(globalThis);
