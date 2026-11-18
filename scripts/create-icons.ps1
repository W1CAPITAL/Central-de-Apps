# W1 Capital · ícones Windows. Somente GDI+ e PowerShell, sem downloads extras.
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$root=Split-Path -Parent $PSScriptRoot
$folder=Join-Path $root 'assets'
New-Item -ItemType Directory -Path $folder -Force | Out-Null
$icons=@(
 @{Id='central';Mark='W1';Start='#651a31';End='#170e16'},
 @{Id='lexispredict';Mark='L';Start='#80324b';End='#260c1c'},
 @{Id='infinitum';Mark='I';Start='#6f3159';End='#1d0e25'},
 @{Id='predictbot';Mark='P';Start='#792546';End='#241020'}
)
foreach($item in $icons){
 $size=256
 $image=[System.Drawing.Bitmap]::new($size,$size)
 $graphics=[System.Drawing.Graphics]::FromImage($image)
 $graphics.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
 $graphics.TextRenderingHint=[System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
 $graphics.Clear([System.Drawing.Color]::FromArgb(19,12,18))
 $bounds=[System.Drawing.Rectangle]::new(0,0,$size,$size)
 $brush=[System.Drawing.Drawing2D.LinearGradientBrush]::new($bounds,
  [System.Drawing.ColorTranslator]::FromHtml($item.Start),
  [System.Drawing.ColorTranslator]::FromHtml($item.End),45.0)
 $graphics.FillRectangle($brush,$bounds)
 $pen=[System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(170,199,151,167),5)
 $graphics.DrawRectangle($pen,12,12,232,232)
 $font=[System.Drawing.Font]::new('Georgia',116,[System.Drawing.FontStyle]::Bold,[System.Drawing.GraphicsUnit]::Pixel)
 $mark=$item.Mark
 $measured=$graphics.MeasureString($mark,$font)
 $silver=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(240,228,230))
 $x=($size-$measured.Width)/2-5
 $y=($size-$measured.Height)/2+3
 $graphics.DrawString($mark,$font,$silver,[float]$x,[float]$y)
 $stream=[System.IO.MemoryStream]::new()
 $image.Save($stream,[System.Drawing.Imaging.ImageFormat]::Png)
 $png=$stream.ToArray()
 $path=Join-Path $folder ($item.Id+'.ico')
 $file=[System.IO.File]::Create($path)
 $writer=[System.IO.BinaryWriter]::new($file)
 $writer.Write([uint16]0);$writer.Write([uint16]1);$writer.Write([uint16]1)
 $writer.Write([byte]0);$writer.Write([byte]0);$writer.Write([byte]0);$writer.Write([byte]0)
 $writer.Write([uint16]1);$writer.Write([uint16]32)
 $writer.Write([uint32]$png.Length);$writer.Write([uint32]22)
 $writer.Write($png)
 $writer.Dispose();$file.Dispose()
 $stream.Dispose();$graphics.Dispose();$pen.Dispose();$font.Dispose();$silver.Dispose();$brush.Dispose();$image.Dispose()
 if((Get-Item $path).Length -lt 1000){throw 'Icone Windows vazio: '+$path}
 Write-Output ($item.Id+': '+$path)
}
