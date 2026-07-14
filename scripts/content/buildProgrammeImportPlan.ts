import { buildProgrammeImportPlan, buildProgrammeImportPlanMarkdown, loadAndValidateProgrammeContent } from './programmeContentContract'

function main(): void {
  const inputPath = process.argv.slice(2).find((value) => value !== '--')
  if (!inputPath) {
    console.error('Usage: pnpm content:programme:import-plan -- <repository-relative-json-path>')
    process.exitCode = 1
    return
  }

  try {
    const result = loadAndValidateProgrammeContent(inputPath)
    const plan = buildProgrammeImportPlan(result)
    process.stdout.write(`${buildProgrammeImportPlanMarkdown(plan)}\n`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

main()
