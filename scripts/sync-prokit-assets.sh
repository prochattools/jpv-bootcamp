#!/usr/bin/env bash
set -euo pipefail

PROKIT_REPO="${PROKIT_REPO:-https://github.com/prochattools/prokit.git}"
PROKIT_REF="${PROKIT_REF:-main}"
PROKIT_TMP_DIR="${PROKIT_TMP_DIR:-.tmp/prokit-sync}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ "${PROKIT_TMP_DIR}" != /* ]]; then
	PROKIT_TMP_DIR="${ROOT_DIR}/${PROKIT_TMP_DIR}"
fi

PROKIT_REPO_DIR="${PROKIT_TMP_DIR}/repo"

if ! command -v git >/dev/null 2>&1; then
	echo "git is required but was not found in PATH." >&2
	exit 1
fi

mkdir -p "${PROKIT_REPO_DIR}"

if [[ -d "${PROKIT_REPO_DIR}/.git" ]]; then
	git -C "${PROKIT_REPO_DIR}" fetch --all --tags --prune
else
	git clone --filter=blob:none --no-checkout "${PROKIT_REPO}" "${PROKIT_REPO_DIR}"
fi

if ! git -C "${PROKIT_REPO_DIR}" sparse-checkout list >/dev/null 2>&1; then
	git -C "${PROKIT_REPO_DIR}" sparse-checkout init --cone
fi

git -C "${PROKIT_REPO_DIR}" sparse-checkout set docs scripts/db scripts/dev README.md

resolve_ref() {
	if git -C "${PROKIT_REPO_DIR}" rev-parse --verify "${PROKIT_REF}^{commit}" >/dev/null 2>&1; then
		echo "${PROKIT_REF}"
		return 0
	fi
	if git -C "${PROKIT_REPO_DIR}" rev-parse --verify "origin/${PROKIT_REF}^{commit}" >/dev/null 2>&1; then
		echo "origin/${PROKIT_REF}"
		return 0
	fi
	return 1
}

if ! RESOLVED_REF="$(resolve_ref)"; then
	echo "ref not found: ${PROKIT_REF}" >&2
	exit 1
fi

git -C "${PROKIT_REPO_DIR}" checkout --detach "${RESOLVED_REF}"

copied=0
missing=0

copy_file() {
	local src="$1"
	local dst="$2"

	if [[ ! -f "${src}" ]]; then
		echo "MISSING ${src}"
		((missing+=1))
		return 0
	fi

	mkdir -p "$(dirname "${dst}")"
	if [[ -e "${dst}" ]]; then
		echo "OVERWRITE ${dst}"
	fi
	cp -a "${src}" "${dst}"
	echo "COPIED ${dst}"
	((copied+=1))
}

DOCS_FILES=(
	"PROKIT_AI_GUIDELINES.md"
	"PROKIT_DATABASE.md"
	"PROKIT_DEV_GUIDE.md"
	"PROKIT_GETTING_STARTED.md"
	"PROKIT_INFRASTRUCTURE.md"
	"PROKIT_INVARIANTS.md"
	"PROKIT_OVERVIEW.md"
	"PROKIT_README_TEMPLATE.md"
	"PROKIT_README_TRUSTLESS.md"
	"PROKIT_REFERENCE.md"
	"PROKIT_TENANT_CLEANUP.md"
	"git-workflow.md"
)

for file in "${DOCS_FILES[@]}"; do
	copy_file "${PROKIT_REPO_DIR}/docs/${file}" "${ROOT_DIR}/docs/${file}"
done

copy_file \
	"${PROKIT_REPO_DIR}/scripts/db/cleanup-tenant.js" \
	"${ROOT_DIR}/scripts/db/cleanup-tenant.js"
copy_file \
	"${PROKIT_REPO_DIR}/scripts/db/init-tenant.js" \
	"${ROOT_DIR}/scripts/db/init-tenant.js"
copy_file \
	"${PROKIT_REPO_DIR}/scripts/dev/bootstrap-env.js" \
	"${ROOT_DIR}/scripts/dev/bootstrap-env.js"
copy_file \
	"${PROKIT_REPO_DIR}/scripts/dev/check-env.js" \
	"${ROOT_DIR}/scripts/dev/check-env.js"

copy_file \
	"${PROKIT_REPO_DIR}/README.md" \
	"${ROOT_DIR}/README.prokit-template.md"

echo "ProKit sync complete: copied ${copied}, missing ${missing} (repo: ${PROKIT_REPO}, ref: ${PROKIT_REF})"

if [[ "${copied}" -eq 0 ]]; then
	exit 1
fi
