"""GPL-2.0-or-later. ABI1 reference adapter; unchanged adjacent upstream source.
python build.py --zig /path/to/zig --output /path/to/artifacts --cache /path/to/cache
"""
from pathlib import Path
import argparse,hashlib,json,os,subprocess
p=argparse.ArgumentParser()
p.add_argument('--zig',required=True);p.add_argument('--output',required=True);p.add_argument('--cache',required=True)
a=p.parse_args();S=Path(__file__).resolve().parent;U=S.parent/'source';O=Path(a.output).resolve();O.mkdir(parents=True,exist_ok=True)
C=Path(a.cache).resolve();C.mkdir(parents=True,exist_ok=True)
env=dict(os.environ,ZIG_GLOBAL_CACHE_DIR=str(C/'global'),ZIG_LOCAL_CACHE_DIR=str(C/'local'))
base=[a.zig,'cc','-O2','-fno-fast-math','-I'+str(U),str(U/'thal.c'),str(U/'thal_parameters.c'),str(S/'wrapper.c')]
commands=[base+['-DNATIVE_MAIN','-o',str(O/'native-pair.exe')],
base+['-I'+str(U/'wasi_compat'),'-target','wasm32-wasi','-mexec-model=reactor']+
['-Wl,--export='+n for n in ['abi_version','input_capacity','input_a_ptr','input_b_ptr','drawing_ptr','message_ptr','values_ptr','run_raw']]+
['-Wl,-z,stack-size=1048576','-Wl,--initial-memory=4194304','-Wl,--max-memory=33554432','-o',str(S/'thal-pair.wasm')]]
for cmd in commands:
    print('BUILD '+Path(cmd[-1]).name,flush=True);subprocess.run(cmd,env=env,check=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
manifest={'format':'primer3-pair-adapter/1','version':'0.1.0-dev.1','abi':1,'upstream':'primer3-py 2.3.1 THAL',
'compiler':'Zig 0.14.1','license':'GPL-2.0-or-later','maxLoop':30,'mode':'THL_GENERAL','basis':'primer3-api-reference',
'nativeComparisonTolerance':1e-6,'inputLength':[2,60],'sourceFiles':{n:sha(U/n) for n in ['thal.c','thal.h','thal_parameters.c','thal_parameters.h','gpl-2.0.txt']},
'wrapperSha256':sha(S/'wrapper.c'),'buildSourceSha256':sha(S/'build.py'),
'asset':{'path':'thal-pair.wasm','sha256':sha(S/'thal-pair.wasm'),'bytes':(S/'thal-pair.wasm').stat().st_size},
'limitations':['Engine dna_conc is explicit; actual A/B concentration mapping is not silently assumed.',
'Native/WASM parity is implementation evidence, not experimental prediction accuracy.']}
(S/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
(S/'release.mjs').write_text('// SPDX-License-Identifier: GPL-2.0-or-later\nexport const EXPECTED_MANIFEST_SHA256 = '+json.dumps(sha(S/'manifest.json'))+';\n',encoding='utf-8')
(O/'build-commands.json').write_text(json.dumps(commands,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'wasm_bytes':manifest['asset']['bytes'],'wasm_sha256':manifest['asset']['sha256']}),flush=True)
