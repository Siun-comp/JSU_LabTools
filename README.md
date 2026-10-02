# JSU LabTools

Desktop tools for molecular diagnostics development. Personal use first.

Portal v0.2.1 includes the independent existing IsoAmplar Plot Analysis T link and Oligo Mix tool/algorithm v0.4.0. Sequence, concentration conversion, Amplification Analysis and LoB/LoD/LoQ analysis remain pending. The LoB/LoD/LoQ item is a future copy/theme/improvement plan only and has no execution link.

Oligo Mix performs browser-local theoretical volumes and explicit preparation-volume proposals with manual final editing. Stock volumes use the nearest user-specified interval (ties upwards); TE balances the planned total. Out-of-range/off-grid/zero components are flagged. F/R/P/Q stocks default to editable100µM. Row numbers, inclusion counts and3-column Excel text preview/apply are available; the15-component cap is removed. Copy uses included components only, no reserved rows or borders, with a dynamic final total row. Clipboard copy remains theoretical and does not include the adjusted volumes.

Plasmid supports mass, molar and copies units with explicit conversion basis. No experiment inputs are sent to a server, stored automatically or passed between tools.

Actual Excel paste/font/merge behavior and user workflow verification are pending. Clipboard HTML specifies Malgun Gothic9pt; paste values uses destination formatting. Computational tests and browser clipboard checks do not establish instrument or experimental performance.

Build the complete static artifact with `node scripts/build.mjs`, then verify with `node scripts/verify.mjs`. The complete manifest preserves prior published paths. Internal development documents, attachments, original workbooks and validation files are excluded from this public checkout.

Site: https://siun-comp.github.io/JSU_LabTools/
