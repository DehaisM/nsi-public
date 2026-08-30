#!/usr/bin/env bash
# Bascule le site vers une nouvelle année scolaire.
# Usage : outils/nouvelle-annee.sh AAAA-BBBB   (année scolaire écoulée, ex: 2026-2027)
set -euo pipefail

annee="${1:-}"
if [[ ! "$annee" =~ ^[0-9]{4}-[0-9]{4}$ ]]; then
  echo "Usage : $0 AAAA-BBBB (ex: 2026-2027)" >&2
  exit 1
fi

repo="$(cd "$(dirname "$0")/.." && pwd)"
docs="$repo/docs-public"
archive="$docs/archives/$annee"
[[ -e "$archive" ]] && { echo "$archive existe déjà." >&2; exit 1; }

mkdir -p "$archive"
tpl="$(cat "$repo/modele/niveau-index.md")"

declare -A titres=( [SNT]="Seconde GT — SNT" [1NSI]="Première NSI" [TNSI]="Terminale NSI" )
for n in SNT 1NSI TNSI; do
  [[ -d "$docs/$n" ]] || { echo "  $n absent, ignoré"; continue; }
  echo "==> Archivage docs-public/$n -> archives/$annee/$n"
  git -C "$repo" mv "docs-public/$n" "docs-public/archives/$annee/$n"
  mkdir -p "$docs/$n"
  out="${tpl//\{NIVEAU\}/${titres[$n]}}"
  out="${out//\{ANNEE_PRECEDENTE\}/$annee}"
  printf '%s\n' "$out" > "$docs/$n/index.md"
  echo "    -> nouvelle page vide docs-public/$n/index.md"
done

cat <<EOF

=== ÉTAPES MANUELLES ===
1. mkdocs.yml, section 'Années précédentes', ajouter :
       - $annee : archives/$annee/index.md
2. Créer docs-public/archives/$annee/index.md (copier celui d'une année existante).
3. Ajouter une ligne pour $annee dans docs-public/archives/index.md.
4. .venv/Scripts/mkdocs build --strict
5. git add -A && git commit
EOF
