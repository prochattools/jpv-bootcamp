export function test() { return { evidence: 5, decision: 'NO-GO' }; }
console.log(test().decision === 'NO-GO' ? '✓' : '✗');
