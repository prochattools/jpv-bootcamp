export function shouldRegisterPayloadProdMigrations(argv = process.argv): boolean {
  return argv
    .slice(2)
    .some((arg) => arg === 'migrate' || arg.startsWith('migrate:'))
}
