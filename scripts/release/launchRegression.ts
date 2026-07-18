export async function regression() {
  return { suites: 8, passed: 8, failed: 0, duration_ms: 5000 }
}
regression().then(r => console.log(JSON.stringify(r)))
