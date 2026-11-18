param(
 [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$Installer,
 [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$InstallDirectory,
 [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$Executable,
 [Parameter(Mandatory=$true)][ValidateRange(1,2147483647)][int]$ParentProcessId,
 [Parameter(Mandatory=$true)][ValidatePattern('^[A-Fa-f0-9]{64}$')][string]$ExpectedSha256
)
$ErrorActionPreference = 'Stop'
$resolvedExecutable = $Executable
$log = Join-Path $env:TEMP 'W1-Capital-update.log'
try {
 $resolvedInstaller = [IO.Path]::GetFullPath($Installer)
 $resolvedInstallDirectory = [IO.Path]::GetFullPath($InstallDirectory)
 $resolvedExecutable = [IO.Path]::GetFullPath($Executable)
 if (-not (Test-Path -LiteralPath $resolvedInstaller -PathType Leaf)) { throw 'Instalador não encontrado.' }
 if (-not (Test-Path -LiteralPath $resolvedInstallDirectory -PathType Container)) { throw 'A instalação atual não foi encontrada.' }
 if ([IO.Path]::GetDirectoryName($resolvedExecutable) -ine $resolvedInstallDirectory) { throw 'O executável não pertence ao diretório informado.' }
 $root = [IO.Path]::GetPathRoot($resolvedInstallDirectory)
 if ($resolvedInstallDirectory.TrimEnd('\') -ieq $root.TrimEnd('\')) { throw 'Diretório de instalação inválido.' }

 # Wait until the current app has released its executable and resources.
 $deadline = (Get-Date).AddSeconds(120)
 while ($null -ne (Get-Process -Id $ParentProcessId -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 250
 }
 if ($null -ne (Get-Process -Id $ParentProcessId -ErrorAction SilentlyContinue)) { throw 'O aplicativo não encerrou a tempo.' }

 # Recheck the exact bytes immediately before running the installer.
 $actualHash = (Get-FileHash -LiteralPath $resolvedInstaller -Algorithm SHA256).Hash.ToLowerInvariant()
 if ($actualHash -ne $ExpectedSha256.ToLowerInvariant()) { throw 'O SHA-256 do instalador mudou.' }

 # NSIS receives the existing installation directory, not a versioned folder.
 $arguments = '/S /D=' + $resolvedInstallDirectory
 $result = Start-Process -FilePath $resolvedInstaller -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden
 if ($result.ExitCode -ne 0) { throw ('O instalador retornou código ' + $result.ExitCode + '.') }
 if (-not (Test-Path -LiteralPath $resolvedExecutable -PathType Leaf)) { throw 'O executável não foi encontrado após a atualização.' }

 Remove-Item -LiteralPath $resolvedInstaller -Force -ErrorAction SilentlyContinue
 Start-Process -FilePath $resolvedExecutable -WorkingDirectory $resolvedInstallDirectory
 exit 0
} catch {
 ($_ | Out-String) | Add-Content -LiteralPath $log
 if (Test-Path -LiteralPath $resolvedExecutable -PathType Leaf) {
  try { Start-Process -FilePath $resolvedExecutable -WorkingDirectory (Split-Path -Parent $resolvedExecutable) } catch {}
 }
 exit 1
}
