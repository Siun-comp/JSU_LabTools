# JSU LabTools

Portal v1.0.0 — first regular release of the selected desktop tool scope.

| Tool | Tool / algorithm |
|---|---|
| Oligo Mix | 1.0.0 / 0.5.0 |
| Sequence | 1.0.0 / 0.2.1 |
| Dilution and reagent preparation | 1.0.0 / 0.3.0 |
| Nucleic-acid concentration / copies | 1.0.0 / 0.2.0 |

IsoAmplar Plot Analysis T remains an external independent new-tab link. Amplification Analysis and LoB/LoD/LoQ remain pending.

Inputs are processed in browser memory. No automatic upload, storage, external computation API or cross-tool data handoff is provided. Sequence runs in an independent portal dialog. Oligo, dilution and nucleic-acid tools run in new tabs.

The source-to-public-path mapping is in public-manifest.json. Build the complete 30-asset dist with Node.js24 or later, without installing packages:

```text
node scripts/build.mjs
node scripts/verify.mjs
```

GitHub Pages publishes only dist through the existing Actions workflow. All22 previously published asset paths are retained. Internal docs, validation artifacts, design mockups, attachments, original workbooks and reference-app source are excluded.

P5 fixes preserve full calculation input and report limits explicitly. Manual pipette review uses selected volumes. Nucleic clipboard completion warns when conditions changed. Oligo Excel paste has prior user confirmation; production-document, instrument and experimental validation are separate. Synthetic/browser tests do not establish actual sample accuracy or clinical performance. User real-workflow checks remain pending.
