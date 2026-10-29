# Oligo Thermodynamics integrated beta regression

2026-10-30 / UI0.2.0-beta.1. Run `node scripts/regression.mjs` for all41 modules. Added suite/structure/Beacon/relationship/export tests use synthetic inputs; they cover fixed geometry, explicit support limits, partial fields, reference vs actual conditions, same-model PM/MM, output provenance and old-format compatibility. No private source/experimental or user data is required. `short-reference.json` is a synthetic pinned-model implementation oracle. The two fixture snapshots preserve synthetic Pair/Beacon export inputs from the earlier candidate. Full public browser/clipboard acceptance is a separate publication check.

The fixed NN3/IMM table and unchanged licensed source/rights ship under `tools/oligo-thermodynamics/fixed-source/`. These tests prove defined implementation behavior, not independent experimental accuracy.

# Oligo Thermodynamics fixed regression

GPL-2.0-or-later. Synthetic sequences only; no user or experimental data.

`reference.json`: existing 228 duplex conditions (Biopython1.88 DNA_NN4/entropy salt) and paired native THAL results with structure off/on, generated from pinned primer3-py2.3.1 source. WASM/native implementation agreement tolerance1e-6; duplex1e-8. `mg-reference.json`: existing935 synthetic NN4/Owczarzy2008 inverse-Tm conditions, Biopython1.88 saltcorr7, tolerance1e-8°C. These are implementation references, not independent wet-lab validation or a new empirical sample size.

Run from repository root: `node scripts/regression.mjs`. The five new modules check core contracts, partial-Mg output, explicitly separate Mg0 reference/export,935 Mg Tm cases,228 duplex cases and456 WASM structure off/on runs. Browser/live acceptance is separately recorded at publication. Engine model/version, units and published limits are described in tools/oligo-thermodynamics/validation.html; complete corresponding C/parameters/wrapper/build instructions ship with the WASM under engine/source.
