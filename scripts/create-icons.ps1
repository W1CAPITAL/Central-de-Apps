# Usa a mesma arte do catálogo nos atalhos e instaladores do Windows.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$folder = Join-Path $root 'assets'
New-Item -ItemType Directory -Path $folder -Force | Out-Null
foreach ($id in @('central','lexispredict','infinitum','predictbot')) {
  $png = [IO.File]::ReadAllBytes((Join-Path $root "src/brand/$id.png"))
  $writer = [IO.BinaryWriter]::new([IO.File]::Create((Join-Path $folder "$id.ico")))
  try {
    # ICONDIR + entrada para um PNG de 256 por 256 pixels.
    $writer.Write([uint16]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]1)
    $writer.Write([uint32]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]32)
    $writer.Write([uint32]$png.Length)
    $writer.Write([uint32]22)
    $writer.Write($png)
  } finally {
    $writer.Dispose()
  }
}
