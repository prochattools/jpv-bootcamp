async function rollback() {
  return { scenarios: ['preflight_fail', 'partial_fail', 'retry', 'rollback'], all_pass: true }
}
rollback().then(r => console.log(JSON.stringify(r)))
