import assert from 'node:assert/strict'
import fs from 'node:fs'

const script = fs.readFileSync(new URL('./waitForRootDomainDeployment.mts', import.meta.url), 'utf8')
const workflow = fs.readFileSync(new URL('../../.github/workflows/publish-root-domain-image.yml', import.meta.url), 'utf8')

assert.match(script, /https:\/\/jpvbootcamp\.com/)
assert.match(script, /I_2Vukga3cc3ZhaG-mUzU/)
assert.match(script, /clients-jpv-bootcamp-app-tp9xrk/)
assert.match(script, /\/api\/health\/deployment\?release_probe=/)
assert.match(script, /application\.update/)
assert.match(script, /application\.deploy/)
assert.match(script, /production_runtime_diagnostic/)
assert.match(script, /DOKPLOY_API_KEY/)
assert.match(workflow, /waitForRootDomainDeployment\.mts/)
assert.match(workflow, /EXPECTED_DEPLOYMENT_SHA: \$\{\{ github\.sha \}\}/)
assert.doesNotMatch(script, /preview\.jpvbootcamp\.com/)

console.log('root deployment convergence contract tests passed')
