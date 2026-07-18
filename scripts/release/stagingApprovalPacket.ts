export async function create() {
  return { operations: ['migration', 'types', 'providers'], gates: 3 }
}
create().then(r => console.log(JSON.stringify(r)))
