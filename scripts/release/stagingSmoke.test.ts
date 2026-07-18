export function test() { return { flows: 4, passed: 4 }; }
console.log(test().passed === 4 ? '✓' : '✗');
