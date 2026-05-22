# Sync labels from .github/labels.yml to GitHub (requires: gh auth login)
$ErrorActionPreference = "Stop"
$repo = "schmeckm/pi-sheet-generator"
$labelsFile = Join-Path $PSScriptRoot "..\.github\labels.yml"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Error "GitHub CLI (gh) not found. Install from https://cli.github.com/"
}

$lines = Get-Content $labelsFile
$name = $null
$color = $null
$desc = $null

foreach ($line in $lines) {
  if ($line -match '^- name: (.+)$') {
    if ($name) {
      gh label create $name --repo $repo --color $color --description $desc --force 2>$null
      Write-Host "Label: $name"
    }
    $name = $Matches[1].Trim()
    $color = "ededed"
    $desc = ""
  }
  elseif ($line -match '^\s+color: (.+)$') { $color = $Matches[1].Trim() }
  elseif ($line -match '^\s+description: (.+)$') { $desc = $Matches[1].Trim() }
}
if ($name) {
  gh label create $name --repo $repo --color $color --description $desc --force 2>$null
  Write-Host "Label: $name"
}
Write-Host "Done."
