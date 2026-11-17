param(
 [Parameter(Mandatory=$true)]
 [ValidateNotNullOrEmpty()]
 [string]$Installer
)
$ErrorActionPreference='Stop'
try {
 if (-not (Test-Path -LiteralPath $Installer -PathType Leaf)) { exit 11 }
 $signature = Get-AuthenticodeSignature -LiteralPath $Installer
 if ($signature.Status -ne 'Valid') { exit 12 }
 if (-not $signature.SignerCertificate -or $signature.SignerCertificate.Subject -notmatch 'W1 Capital') { exit 13 }
 exit 0
} catch { exit 14 }
