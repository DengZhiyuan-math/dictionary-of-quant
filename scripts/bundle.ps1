$ErrorActionPreference = 'Stop'
$quantRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$quantDist = Join-Path $quantRoot 'dist'
New-Item -ItemType Directory -Path $quantDist -Force | Out-Null
$quantItems = @('README.md','CONTRIBUTING.md','CHANGELOG.md','package.json','quant_v1_audiobook.html','quant_v1_full.md','quant_v1_index.md','quant_v1_training_terms.md','quant_v2_advanced.md','quant_v3_research.md','quant_v4_market.md','examples','chapters','docs','text','data','src','scripts','sources')
$quantPaths = $quantItems | ForEach-Object { Join-Path $quantRoot $_ }
Compress-Archive -LiteralPath $quantPaths -DestinationPath (Join-Path $quantDist 'quant_v4_bundle.zip') -Force
Write-Output 'Created dist/quant_v4_bundle.zip'
