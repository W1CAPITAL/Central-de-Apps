param(
  [Parameter(Mandatory=$true)][string]$Installer,
  [Parameter(Mandatory=$true)][string]$InstalledDirectory
)
$ErrorActionPreference = 'Stop'
$fake = Join-Path $env:RUNNER_TEMP 'W1-unrelated-lexispredict'
New-Item -ItemType Directory -Force -Path $fake | Out-Null
# This unrelated process has exactly the same filename as the CRM, but
# is in a DIFFERENT folder. Previous KILL_PROCESS by basename killed it.
$unrelatedExe = Join-Path $fake 'LexisPredict.exe'
Copy-Item -LiteralPath (Get-Command node.exe).Source -Destination $unrelatedExe -Force
$unrelated = Start-Process -FilePath $unrelatedExe -ArgumentList @('-e','setInterval(()=>{},1000)') -PassThru -WindowStyle Hidden
try {
  Start-Sleep -Seconds 2
  $unrelated.Refresh()
  if ($unrelated.HasExited) { throw 'O processo de teste não iniciou.' }
  $target = Join-Path $InstalledDirectory 'LexisPredict.exe'
  if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { throw 'Instalação Lexis anterior ausente.' }
  $initialPath = (Resolve-Path -LiteralPath $target).Path
  $update = Start-Process -FilePath $Installer -ArgumentList @('/S',('/D='+$InstalledDirectory)) -PassThru
  if (-not $update.WaitForExit(240000)) { Stop-Process -Id $update.Id -Force -ErrorAction SilentlyContinue; throw 'NSIS não concluiu a atualização.' }
  if ($update.ExitCode -ne 0) { throw "Atualização do Lexis existente falhou com código $($update.ExitCode)." }
  $unrelated.Refresh()
  if ($unrelated.HasExited) { throw 'Atualizar Lexis encerrou outra instalação com o mesmo nome.' }
  if ((Resolve-Path -LiteralPath $target).Path -ne $initialPath) { throw 'Atualização mudou a pasta original.' }
  $copies = @(Get-ChildItem -LiteralPath $InstalledDirectory -Filter LexisPredict.exe -File -Recurse)
  if ($copies.Count -ne 1) { throw 'Atualização criou instalação duplicada.' }
  Write-Host 'NSIS atualizou Lexis na pasta original e preservou outro EXE do mesmo nome em pasta diferente.'
} finally {
  $unrelated.Refresh()
  if (-not $unrelated.HasExited) { Stop-Process -Id $unrelated.Id -Force -ErrorAction SilentlyContinue }
}
