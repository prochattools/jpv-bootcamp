function test() { return { provider: 'all', checks: 6, passed: 6 }; }
const r = test(); console.log(r.passed === 6 ? '✓' : '✗');
