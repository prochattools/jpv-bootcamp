import { execFileSync } from 'node:child_process'

export type RepositoryState = {
  expectedBranch: string
  actualBranch: string
  expectedHead: string
  actualHead: string
  intendedDirtyPaths: string[]
  protectedDirtyPaths: string[]
  stagedPaths: string[]
  currentCommit: string
  repositoryIdentifier: string
}

export function readRepositoryState(
  expectedBranch: string,
  expectedHead: string,
  repositoryIdentifier = 'prochattools/jpv-bootcamp',
  cwd = process.cwd(),
): RepositoryState {
  const actualBranch = execFileSync('git', ['branch', '--show-current'], { cwd, encoding: 'utf8' }).trim()
  const actualHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim()
  const status = execFileSync('git', ['status', '--short'], { cwd, encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
  const stagedPaths = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd, encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const dirtyPaths: string[] = status.map((line) => line.replace(/^[ MARCUD\?\!]+/, '').trim())
  const protectedDirtyPaths: string[] = dirtyPaths.filter((path: string) => path === '.graphifyignore' || path === 'docs/HANDOFF_AUTH_BRANDING_STAGING_2026-06-30.md')
  const intendedDirtyPaths = dirtyPaths.filter((path) => !protectedDirtyPaths.includes(path))
  return {
    expectedBranch,
    actualBranch,
    expectedHead,
    actualHead,
    intendedDirtyPaths,
    protectedDirtyPaths,
    stagedPaths,
    currentCommit: actualHead,
    repositoryIdentifier,
  }
}

export function validateRepositoryState(state: RepositoryState): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  if (state.expectedBranch !== state.actualBranch) errors.push('branch_mismatch')
  if (state.expectedHead !== state.actualHead) errors.push('head_mismatch')
  if (state.stagedPaths.length > 0) errors.push('staged_paths_present')
  if (state.intendedDirtyPaths.length > 0) errors.push('non_protected_dirty_paths_present')
  if (state.repositoryIdentifier !== 'prochattools/jpv-bootcamp') errors.push('repository_identifier_mismatch')
  return { ok: errors.length === 0, errors }
}
