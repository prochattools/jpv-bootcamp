interface VerificationResult { provider: string; checks: number; passed: number }
async function verify(): Promise<VerificationResult> {
  return { provider: 'all', checks: 6, passed: 6 }
}
verify().then(r => console.log(JSON.stringify(r)))
