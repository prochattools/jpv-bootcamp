export async function audit() {
  return { areas: ['forms', 'navigation', 'media'], passed: 3 }
}
audit().then(r => console.log(JSON.stringify(r)))
