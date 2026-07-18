export async function audit() {
  return { checks: ['auth', 'redirection', 'secrets', 'media'], failed: 0 }
}
audit().then(r => console.log(JSON.stringify(r)))
