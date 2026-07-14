import { loadAndValidateProgrammeContent } from './programmeContentContract'

function main(): void {
  const inputPath = process.argv.slice(2).find((value) => value !== '--')
  if (!inputPath) {
    console.error('Usage: pnpm content:programme:validate -- <repository-relative-json-path>')
    process.exitCode = 1
    return
  }

  try {
    const result = loadAndValidateProgrammeContent(inputPath)

    console.log('Programme content validation')
    console.log(`- input: ${result.inputPath}`)
    console.log(`- checksum: ${result.checksum}`)
    console.log(`- structural validation: ${result.structuralValid ? 'passed' : 'failed'}`)
    console.log(`- release eligibility: ${result.releaseEligible ? 'eligible' : 'ineligible'}`)
    console.log(`- weeks: ${result.stats.weekCount}`)
    console.log(`- lessons: ${result.stats.lessonCount}`)
    console.log(`- resources: ${result.stats.resourceCount}`)

    console.log('\nStructural errors')
    if (result.errors.length === 0) {
      console.log('- none')
    } else {
      for (const issue of result.errors) {
        console.log(`- [${issue.code}] ${issue.path}: ${issue.message}`)
      }
    }

    console.log('\nRelease blockers')
    if (result.blockers.length === 0) {
      console.log('- none')
    } else {
      for (const issue of result.blockers) {
        console.log(`- [${issue.code}] ${issue.path}: ${issue.message}`)
      }
    }

    process.exitCode = result.structuralValid ? 0 : 1
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

main()
