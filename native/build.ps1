# Build a small Windows PMS.exe that starts launcher.py and opens the site.
$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))

$outDir = Join-Path (Get-Location) "dist"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$exePath = Join-Path $outDir "PMS.exe"
$source = Get-Content -Raw (Join-Path $PSScriptRoot "PMSLauncher.cs")

$files = @(
  "launcher.py",
  "app.py",
  "database.py",
  "paths.py",
  "requirements.txt"
)
foreach ($f in $files) {
  Copy-Item -Force $f (Join-Path $outDir $f)
}

foreach ($folder in @("templates", "static")) {
  $dest = Join-Path $outDir $folder
  if (Test-Path $dest) {
    Remove-Item -Recurse -Force $dest
  }
  Copy-Item -Recurse $folder $dest
}

Add-Type -TypeDefinition $source -Language CSharp -OutputAssembly $exePath -OutputType ConsoleApplication

Write-Host ""
Write-Host "Built: $exePath"
Write-Host "Double-click dist\PMS.exe to open the website."
Write-Host "Close the console window to stop the server."
