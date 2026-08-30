<#
.SYNOPSIS
    Bascule le site vers une nouvelle année scolaire.
.DESCRIPTION
    - Déplace docs-public/SNT, 1NSI, TNSI vers docs-public/archives/<AnneeEcoulee>/
    - Recrée 3 pages de niveau quasi vides pour la nouvelle année
    - Affiche les étapes manuelles restantes (mkdocs.yml, index.md d'archive)
.PARAMETER AnneeEcoulee
    L'année scolaire qui se termine, au format AAAA-BBBB (ex: 2026-2027).
.PARAMETER DryRun
    Affiche les actions sans rien modifier.
.EXAMPLE
    ./outils/nouvelle-annee.ps1 -AnneeEcoulee 2026-2027
#>
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^\d{4}-\d{4}$')]
    [string]$AnneeEcoulee,

    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$docs = Join-Path $repo 'docs-public'
$archiveDir = Join-Path $docs "archives/$AnneeEcoulee"
$niveaux = [ordered]@{ 'SNT' = 'Seconde GT — SNT'; '1NSI' = 'Première NSI'; 'TNSI' = 'Terminale NSI' }

function Step($msg, $action) {
    Write-Host "==> $msg" -ForegroundColor Cyan
    if ($DryRun) { Write-Host "    (dry-run)" -ForegroundColor DarkGray } else { & $action }
}

if (Test-Path $archiveDir) { throw "$archiveDir existe déjà." }
Step "Création de $archiveDir" { New-Item -ItemType Directory -Force -Path $archiveDir | Out-Null }

$tpl = Get-Content (Join-Path $repo 'modele/niveau-index.md') -Raw

foreach ($n in $niveaux.Keys) {
    $src = Join-Path $docs $n
    if (-not (Test-Path $src)) { Write-Warning "$src absent, ignoré"; continue }
    Step "Archivage docs-public/$n -> archives/$AnneeEcoulee/$n" {
        git -C $repo mv "docs-public/$n" "docs-public/archives/$AnneeEcoulee/$n"
    }
    Step "Nouvelle page vide docs-public/$n/index.md" {
        New-Item -ItemType Directory -Force -Path (Join-Path $docs $n) | Out-Null
        ($tpl -replace '\{NIVEAU\}', $niveaux[$n] -replace '\{ANNEE_PRECEDENTE\}', $AnneeEcoulee) |
            Set-Content -Path (Join-Path $docs "$n/index.md") -Encoding utf8
    }
}

Write-Host "`n=== ÉTAPES MANUELLES ===" -ForegroundColor Green
Write-Host @"
1. mkdocs.yml, section 'Années précédentes', ajouter sous 2025-2026 :
       - $AnneeEcoulee : archives/$AnneeEcoulee/index.md
2. Créer docs-public/archives/$AnneeEcoulee/index.md (copier celui d'une année existante).
3. Ajouter une ligne pour $AnneeEcoulee dans docs-public/archives/index.md.
4. .venv/Scripts/mkdocs.exe build --strict
5. git add -A && git commit
"@
