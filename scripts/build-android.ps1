param([switch]$LegacyUpdate)
$ErrorActionPreference = 'Stop'
$projectPath = Split-Path $PSScriptRoot -Parent
Push-Location $projectPath
try {
  if (Test-Path -LiteralPath '.env') { & node --env-file=.env scripts/check-release-env.cjs }
  else { & node scripts/check-release-env.cjs }
  if ($LASTEXITCODE -ne 0) { throw 'Release environment check failed.' }
  & npm.cmd run check
  if ($LASTEXITCODE -ne 0) { throw 'Code checks failed.' }

  $signingPath = Join-Path $projectPath '.signing'
  $propertiesPath = Join-Path $signingPath 'release.properties'
  $keystorePath = Join-Path $signingPath 'kulucka-release.jks'
  $legacyBackupPath = Join-Path $signingPath 'legacy-update.keystore'
  if ((Test-Path -LiteralPath 'android/app/debug.keystore') -and !(Test-Path -LiteralPath $legacyBackupPath)) {
    New-Item -ItemType Directory -Path $signingPath -Force | Out-Null
    Copy-Item -LiteralPath 'android/app/debug.keystore' -Destination $legacyBackupPath
  }
  if (!$LegacyUpdate -and !(Test-Path -LiteralPath $propertiesPath)) {
    if (Test-Path -LiteralPath $keystorePath) { throw 'Existing keystore found without credentials. Restore release.properties; do not replace the key.' }
    New-Item -ItemType Directory -Path $signingPath -Force | Out-Null
    $randomBytes = New-Object byte[] 32
    $randomGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $randomGenerator.GetBytes($randomBytes) } finally { $randomGenerator.Dispose() }
    $releasePassword = [BitConverter]::ToString($randomBytes).Replace('-', '')
    $env:KULUCKA_RELEASE_PASSWORD = $releasePassword
    try {
      $keytoolPath = Join-Path $env:JAVA_HOME 'bin/keytool.exe'
      & $keytoolPath -genkeypair -noprompt -keystore $keystorePath -storetype JKS -alias kulucka-release -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Kulucka Takip, O=Kulucka Takip, C=TR' -storepass:env KULUCKA_RELEASE_PASSWORD -keypass:env KULUCKA_RELEASE_PASSWORD
      if ($LASTEXITCODE -ne 0) { throw 'Signing key generation failed.' }
      @("storeFile=../.signing/kulucka-release.jks", "storePassword=$releasePassword", 'keyAlias=kulucka-release', "keyPassword=$releasePassword") | Set-Content -LiteralPath $propertiesPath -Encoding ASCII
    } finally { Remove-Item Env:KULUCKA_RELEASE_PASSWORD -ErrorAction SilentlyContinue }
    Write-Host 'Release key created in .signing. Back up this folder privately for future updates.'
  }

  $version = (Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json).version
  $env:NODE_ENV = 'production'
  Push-Location android
  try {
    $buildArgs = @(':app:assembleRelease', '-PreactNativeArchitectures=armeabi-v7a,arm64-v8a', '--console=plain')
    if ($LegacyUpdate) { $buildArgs += '-PlegacyUpdate=true' }
    & .\gradlew.bat @buildArgs
    if ($LASTEXITCODE -ne 0) { throw 'Android release build failed.' }
  } finally { Pop-Location }
  $deliveryPath = Join-Path $projectPath 'output/releases'
  New-Item -ItemType Directory -Path $deliveryPath -Force | Out-Null
  $suffix = if ($LegacyUpdate) { '-mevcut-telefon-guncelleme' } else { '' }
  $apkPath = Join-Path $deliveryPath "KuluckaTakip-$version$suffix.apk"
  Copy-Item -LiteralPath 'android/app/build/outputs/apk/release/app-release.apk' -Destination $apkPath -Force
  $hash = (Get-FileHash -LiteralPath $apkPath -Algorithm SHA256).Hash
  "$hash  $([IO.Path]::GetFileName($apkPath))" | Set-Content -LiteralPath "$apkPath.sha256" -Encoding ASCII
  Write-Host "APK ready: $apkPath"
} finally { Pop-Location }
