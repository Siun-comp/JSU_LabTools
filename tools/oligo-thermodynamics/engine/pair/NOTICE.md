# Phase3R Primer3 pair adapter 0.1.0-dev.1

GPL-2.0-or-later. This is a separate development adapter, ABI1 / contract
`thal-pair/1`. The existing hairpin WASM and application are unchanged.

The fixed upstream is the Primer3 C code and embedded thermodynamic parameters
in the primer3-py 2.3.1 source distribution. Unchanged corresponding files are
provided in `../source/`: `thal.c`, `thal.h`, `thal_parameters.c`,
`thal_parameters.h`, and `gpl-2.0.txt`. The WASI trap boundary header is the
unchanged `../source/wasi_compat/setjmp.h`. Native uses real setjmp/longjmp;
WASM traps require discarding the failed Worker. No numeric recovery is added.

Local adapter source is `wrapper.c` and `build.py`. Use Zig 0.14.1 and the
documented build arguments to rebuild. Runtime checks the pinned manifest
and WASM SHA256. This does not claim that all compiler debug sections are
bit-for-bit reproducible from another checkout path.

`dna_conc` is the explicit Primer3 API reference parameter in nM. Physical
A/B inputs are retained separately. No generic physical concentration
conversion or equilibrium interpretation is assumed. Upstream reproduction
does not establish experimental prediction accuracy, candidate ranking,
kinetics, fluorescence, occupancy, or complete ensemble behavior.
