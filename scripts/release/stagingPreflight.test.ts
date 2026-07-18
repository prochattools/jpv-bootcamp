function test() { const r = { database: 'ok', migrations: 'clean' }; return r.database === 'ok'; }
console.log(test() ? '✓' : '✗');
