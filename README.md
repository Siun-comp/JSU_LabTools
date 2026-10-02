# JSU LabTools

Desktop tools for molecular diagnostics development. Personal use first.

Portal v0.3.2 includes the independent existing IsoAmplar Plot Analysis T link, Oligo Mix tool/algorithm v0.5.0 and Sequence tool/algorithm v0.2.1. Concentration conversion, Amplification Analysis and LoB/LoD/LoQ analysis remain pending. The LoB/LoD/LoQ item is a future copy/theme/improvement plan only and has no execution link.

Oligo Mix performs browser-local theoretical volumes and explicit preparation-volume proposals with manual final editing. Stock preparation volumes use per-row user-approved pipette profiles (fine0.002/0.02/0.2/2µL, general0.01/0.1/1/10µL; boundary2/20/200 uses the smaller profile), or a custom interval. Ties round upwards. Residual TE is also rounded, with actual-total difference and expected target deviation displayed. TE rounding does not require split dispensing. Out-of-range/off-grid/zero components are flagged. F/R/P/Q stocks default to editable100µM. Row numbers, inclusion counts and3-column Excel text preview/apply are available; the15-component cap is removed. Copy uses included components only, no reserved rows or borders, with a dynamic final total row. Clipboard copy remains theoretical and does not include the adjusted volumes.

Plasmid supports mass, molar and copies units with explicit conversion basis. No experiment inputs are sent to a server, stored automatically or passed between tools.

The user reports no current Excel paste issues. Individual font/merge/value checks and production workflow verification remain distinct from this user confirmation. Clipboard HTML specifies Malgun Gothic9pt; paste values uses destination formatting. Computational tests and browser clipboard checks do not establish instrument or experimental performance.

Build the complete static artifact with `node scripts/build.mjs`, then verify with `node scripts/verify.mjs`. The complete manifest preserves prior published paths. Internal development documents, attachments, original workbooks and validation files are excluded from this public checkout.

Site: https://siun-comp.github.io/JSU_LabTools/

The independent quick calculator accepts solution concentration/unit, per-reaction added volume and final reaction volume to recover a final concentration from production instructions recorded as volumes. It uses C×V/Vreaction, keeps the concentration unit and does not change the main mix. No production documents are uploaded or modified.

Sequence opens in an independent dialog on the portal page. Raw input, cleanup/error review and output are separate monospace panes. DNA output converts U to T; RNA output converts T to U. Conversion letters are highlighted, mixed T/U produces a notice without blocking output, and other unsupported characters or malformed input remain blocking. Reverse, Complement, uppercase output, Clear, plain text/FASTA copy and final lengths are provided. Output is recalculated from the original input; modification slash regions are removed without interpreting their biological meaning. Processing occurs only in browser memory. Real user sequence validation is pending; synthetic and browser checks are not experimental or clinical validation.
