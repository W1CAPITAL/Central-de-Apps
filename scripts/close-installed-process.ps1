# NSIS only: gracefully close the executable at the exact installation path.
# Never terminate another LexisPredict or Central installation by image name.
$ErrorActionPreference = 'Stop'
$target = $env:W1_INSTALL_TARGET_EXE
if ([string]::IsNullOrWhiteSpace($target)) { exit 4 }
try { $target = [IO.Path]::GetFullPath($target) } catch { exit 4 }
$name = [IO.Path]::GetFileNameWithoutExtension($target)
function GetTargetProcess {
  @(Get-Process -Name $name -ErrorAction SilentlyContinue | Where-Object {
    try { [String]::Equals($_.Path, $target, [StringComparison]::OrdinalIgnoreCase) }
    catch { $false }
  })
}
try {
  $items = @(GetTargetProcess)
  foreach ($item in $items) {
    try { [void]$item.CloseMainWindow() } catch { }
  }
  $deadline = [DateTime]::UtcNow.AddSeconds(20)
  while ($items.Count -gt 0 -and [DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 600
    $items = @(GetTargetProcess)
  }
  if ($items.Count -gt 0) { exit 2 }
  exit 0
} catch { exit 4 }
