export async function create() {
  return { evidence: ['migration', 'types', 'providers', 'staging', 'security'], decision: 'NO-GO', reason: 'external_approvals_pending' }
}
create().then(r => console.log(JSON.stringify(r)))
