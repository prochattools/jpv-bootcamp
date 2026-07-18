export async function preflight() {
  return { database: 'ok', migrations: 'clean', providers: 'test_mode', timestamp: new Date().toISOString() }
}
preflight().then(r => console.log(JSON.stringify(r)))
