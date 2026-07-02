import { buildPreviewReadinessReport } from '../../src/lib/previewReadinessConfig'

const report = buildPreviewReadinessReport(process.env)

console.log(JSON.stringify(report, null, 2))

if (!report.readyForApplicationOnlyPreview) {
  process.exitCode = 1
}
