"""GPL-2.0-or-later. Rebuild unchanged upstream THAL + local wrapper.
Usage: python build.py --zig /absolute/path/to/zig --output /output/directory
Compiler: Zig 0.14.1, default single-thread WASI reactor (no WASM EH / SAB).
"""
from pathlib import Path
import argparse,subprocess
p=argparse.ArgumentParser();p.add_argument('--zig',required=True);p.add_argument('--output',required=True);a=p.parse_args()
S=Path(__file__).resolve().parent;O=Path(a.output).resolve();O.mkdir(parents=True,exist_ok=True)
base=[a.zig,'cc','-O2','-fno-fast-math','-I'+str(S),str(S/'thal.c'),str(S/'thal_parameters.c'),str(S/'wrapper.c')]
subprocess.run(base+['-DNATIVE_MAIN','-o',str(O/'native-hairpin.exe')],check=True)
subprocess.run(base+['-I'+str(S/'wasi_compat'),'-target','wasm32-wasi','-mexec-model=reactor','-Wl,--export=hp','-Wl,--export=input_ptr','-Wl,--export=output_ptr','-Wl,--export=structure_ptr','-Wl,--export=message_ptr','-Wl,-z,stack-size=1048576','-Wl,--initial-memory=4194304','-Wl,--max-memory=33554432','-o',str(O/'hairpin.wasm')],check=True)
