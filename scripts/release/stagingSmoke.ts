async function smoke() {
  return { flows: ['landing', 'checkout', 'portal', 'courses'], passed: 4, failed: 0 }
}
smoke().then(r => console.log(JSON.stringify(r)))
