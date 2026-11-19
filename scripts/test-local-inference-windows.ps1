param()
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = Join-Path $env:RUNNER_TEMP 'w1-local-ai-real-inference'
New-Item -ItemType Directory -Force -Path $root | Out-Null
$engineUrl = 'https://github.com/ggml-org/llama.cpp/releases/download/b12521/llama-b12521-bin-win-cpu-x64.zip'
$modelUrl = 'https://huggingface.co/ggml-org/Qwen3-1.7B-GGUF/resolve/daeb8e2d528a760970442092f6bf1e55c3b659eb/Qwen3-1.7B-Q4_K_M.gguf'
$engineSha = 'bd4e093bce292452248c318d4b176fbfebe1ca43a7f3779ebb3846fe7753653e'
$modelSha = 'd2387ca2dbfee2ffabce7120d3770dadca0b293052bc2f0e138fdc940d9bc7b5'
$engineZip = Join-Path $root 'engine.zip'
$modelFile = Join-Path $root 'Qwen3-1.7B-Q4_K_M.gguf'
function Get-VerifiedFile([string]$url,[string]$path,[string]$sha) {
  Write-Host "Obtendo origem oficial: $url"
  & curl.exe -fLSs --retry 3 --retry-delay 3 --connect-timeout 20 --max-time 1500 -o $path $url
  if ($LASTEXITCODE -ne 0) { throw "Download falhou: $url" }
  $actual = (Get-FileHash -Algorithm SHA256 -Path $path).Hash.ToLowerInvariant()
  if ($actual -ne $sha) { throw "Hash SHA256 divergente para $path" }
  Write-Host "SHA256 validado: $actual"
}
Get-VerifiedFile $engineUrl $engineZip $engineSha
Get-VerifiedFile $modelUrl $modelFile $modelSha
$extractDir = Join-Path $root 'server'
Expand-Archive -LiteralPath $engineZip -DestinationPath $extractDir -Force
$server = Get-ChildItem -LiteralPath $extractDir -Recurse -File -Filter 'llama-server.exe' | Select-Object -First 1
if (!$server) { throw 'llama-server.exe ausente no ZIP oficial.' }
$apiKey = ([guid]::NewGuid()).ToString('N') + ([guid]::NewGuid()).ToString('N')
$keyFile = Join-Path $root 'server.key'
[System.IO.File]::WriteAllText($keyFile, $apiKey + "`n", [System.Text.Encoding]::ASCII)
$stdoutFile = Join-Path $root 'server-out.log'
$stderrFile = Join-Path $root 'server-error.log'
$arguments = @(
 '--model', ('"' + $modelFile + '"'),
 '--host','127.0.0.1',
 '--port','8765',
 '--api-key-file', ('"' + $keyFile + '"'),
 '--ctx-size','1024',
 '--threads','2',
 '--threads-batch','2',
 '--gpu-layers','0',
 '--parallel','1',
 '--no-webui',
 '--sleep-idle-seconds','300',
 '--alias','w1-qwen3-1.7b'
)
$process = $null
try {
  $process = Start-Process -FilePath $server.FullName -WorkingDirectory $server.Directory.FullName -ArgumentList $arguments -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
  $headers = @{Authorization = "Bearer $apiKey"}
  $healthy = $false
  for ($attempt=0; $attempt -lt 160; $attempt++) {
    Start-Sleep -Seconds 2
    $process.Refresh()
    if ($process.HasExited) {
      $err = Get-Content $stderrFile -Raw -ErrorAction SilentlyContinue
      throw "O servidor saiu com código $($process.ExitCode). Logs: $($err.Substring(0,[Math]::Min(3000,$err.Length)))"
    }
    try {
      $models = Invoke-RestMethod -Uri 'http://127.0.0.1:8765/v1/models' -Headers $headers -TimeoutSec 4
      if (@($models.data | Where-Object { $_.id -eq 'w1-qwen3-1.7b' }).Count -gt 0) { $healthy = $true; break }
    } catch {}
  }
  if (!$healthy) { throw 'llama-server não conseguiu carregar o Qwen3 até o prazo de teste.' }
  Write-Host 'Servidor carregado e alias oficial confirmado.'
  $prompt = @{
    model='w1-qwen3-1.7b'
    messages=@(@{role='user';content='Responda apenas: OK'})
    stream=$false
    max_tokens=120
  } | ConvertTo-Json -Depth 8
  $result = Invoke-RestMethod -Uri 'http://127.0.0.1:8765/v1/chat/completions' -Method Post -Headers $headers -ContentType 'application/json' -Body $prompt -TimeoutSec 180
  if (!$result.choices -or $result.choices.Count -lt 1) { throw 'A inferência local não retornou choices válidas.' }
  $content = [string]$result.choices[0].message.content
  $reasoning = [string]$result.choices[0].message.reasoning_content
  if (!$content.Trim() -and !$reasoning.Trim()) { throw 'A inferência não gerou texto nem raciocínio.' }
  Write-Host "Inferência real via CPU concluída. Modelo $($result.model), tokens $($result.usage.total_tokens)."
} finally {
  if ($process -and !$process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
}
