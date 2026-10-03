/* Exact mirror; verified against work/template-v3/schema.json. */
window.WorkbookTemplateV3 = {
  "version": "3.0-minimal-design",
  "versionCell": "안내!B4",
  "dataKindCell": "안내!B5",
  "dataKinds": ["실제", "합성"],
  "sheetNames": ["안내", "LoD", "Confirmation", "LoB", "LoQ"],
  "common": {"unitCell":"B4", "settingCell":"B5", "groupCell":"B6", "sourceCell":"B7", "settingEncoding":"fraction", "numberScale":"raw"},
  "modules": {
    "LoD": {"kind":"binary_counts", "setting":"targetProbability", "headers":["농도", "분석 대상 N", "양성 수"], "headerRow":10, "dataStartRow":11, "dataEndRow":1010, "fields":["concentration","n","positive"]},
    "Confirmation": {"kind":"binary_counts", "setting":"observedRateCriterion", "headers":["시험 농도", "분석 대상 N", "양성 수"], "headerRow":10, "dataStartRow":11, "dataEndRow":1010, "fields":["concentration","n","positive"]},
    "LoB": {"kind":"blank_values", "setting":"alpha", "headers":["Blank 측정값"], "headerRow":10, "dataStartRow":11, "dataEndRow":1010, "fields":["value"]},
    "LoQ": {"kind":"sample_values", "setting":"teLimitFractionOfReference", "sampleStartColumn":"B", "sampleEndColumn":"I", "sampleNameRow":10, "referenceRow":11, "referenceSourceRow":12, "headerRow":14, "dataStartRow":15, "dataEndRow":1014, "fields":["sampleName","referenceValue","referenceSource","values"]}
  }
};
