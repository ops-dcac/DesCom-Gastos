$file = "Codigo.js"
$content = Get-Content $file -Raw -Encoding UTF8
$old = "var tieneCargar = row[12] ? 'Sí' : '';"
$new = "var tieneCargar = row[11] === acN ? 'Sí' : '';"
$content = $content.Replace($old, $new)
[System.IO.File]::WriteAllText((Join-Path $PWD $file), $content, [System.Text.UTF8Encoding]::new($false))
Write-Host "Cambio aplicado" -ForegroundColor Green
