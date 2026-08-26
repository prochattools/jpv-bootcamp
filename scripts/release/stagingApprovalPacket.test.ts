export function test() { return { operations: 3, gates: 3 }; }
console.log(test().gates === 3 ? '✓' : '✗');
