export async function audit() {
  return { pages: ['landing', 'portal', 'courses'], optimized: 3 }
}
audit().then(r => console.log(JSON.stringify(r)))
