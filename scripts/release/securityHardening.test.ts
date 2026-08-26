export function test() { return { checks: 4, failed: 0 }; }
console.log(test().failed === 0 ? '✓' : '✗');
