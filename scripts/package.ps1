[CmdletBinding()]
param(
    [string]$OutputDirectory,
    [string]$Tag,
    [string]$ReleaseNotesPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content -LiteralPath (Join-Path $repoRoot 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$version = $manifest.version
$part = '(0|[1-9][0-9]{0,4})'
if ($version -isnot [string] -or $version -notmatch "\A$part\.$part\.$part\z" -or $version -eq '0.0.0') {
    throw 'manifest.version must be a nonzero x.y.z Chrome version without leading zeros.'
}
foreach ($number in $version.Split('.')) {
    if ([int]$number -gt 65535) { throw 'Chrome version components must be at most 65535.' }
}

$releaseVersion = $version
$versionName = $manifest.PSObject.Properties['version_name']
if ($null -ne $versionName) {
    $releaseVersion = $versionName.Value
    $candidatePattern = '\A' + [regex]::Escape($version) + '-(alpha|beta|rc)\.[1-9][0-9]*\z'
    if ($releaseVersion -isnot [string] -or
        ($releaseVersion -cne $version -and $releaseVersion -cnotmatch $candidatePattern)) {
        throw 'version_name must match version or append -alpha.N, -beta.N, or -rc.N (N >= 1).'
    }
}
$isPrerelease = $releaseVersion -cne $version
if ($Tag -and $Tag -cne "v$releaseVersion") {
    throw "Tag '$Tag' does not match release version 'v$releaseVersion'."
}

$changelog = Get-Content -LiteralPath (Join-Path $repoRoot 'CHANGELOG.md') -Raw -Encoding UTF8
$heading = '(?ms)^## ' + [regex]::Escape($releaseVersion) + ' \([0-9]{4}-[0-9]{2}-[0-9]{2}\)\r?\n(.*?)(?=^## |\z)'
$sections = [regex]::Matches($changelog, $heading)
if ($sections.Count -ne 1 -or [string]::IsNullOrWhiteSpace($sections[0].Groups[1].Value)) {
    throw "Expected exactly one nonempty dated CHANGELOG section for $releaseVersion."
}
$releaseNotes = $sections[0].Groups[1].Value.Trim()

function Get-PackageFiles([string]$root) {
    $list = [System.Collections.Generic.List[string]]::new()
    $list.Add('manifest.json')
    $list.Add('LICENSE')
    $sourceRoot = Join-Path $root 'src'
    if (Test-Path -LiteralPath $sourceRoot -PathType Container) {
        Get-ChildItem -LiteralPath $sourceRoot -Recurse -File |
            Where-Object { $_.Extension -in '.js', '.css', '.html' } |
            ForEach-Object { $list.Add('src/' + $_.FullName.Substring($sourceRoot.Length + 1).Replace('\', '/')) }
    }
    $localeRoot = Join-Path $root '_locales'
    if (Test-Path -LiteralPath $localeRoot -PathType Container) {
        Get-ChildItem -LiteralPath $localeRoot -Directory |
            ForEach-Object { $list.Add('_locales/' + $_.Name + '/messages.json') }
    }
    foreach ($icon in 'icons/icon16.png', 'icons/icon48.png', 'icons/icon128.png') { $list.Add($icon) }
    return @($list | Sort-Object -Unique)
}
$files = Get-PackageFiles $repoRoot
foreach ($required in 'src/background.js', 'src/shared/sites.js', 'src/shared/settings-utils.js',
    'src/popup/popup.html', 'src/help/help.html', '_locales/en/messages.json') {
    if ($files -cnotcontains $required) { throw "Missing package file: $required" }
}
foreach ($file in $files) {
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $file) -PathType Leaf)) {
        throw "Missing package file: $file"
    }
}
if (-not $OutputDirectory) { $OutputDirectory = $repoRoot }
$outputRoot = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
[void][System.IO.Directory]::CreateDirectory($outputRoot)
$archivePath = Join-Path $outputRoot "roomy-$releaseVersion.zip"
$temporaryZip = Join-Path $outputRoot ('.roomy-' + [guid]::NewGuid().ToString('N') + '.zip')

Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
try {
    $archive = [System.IO.Compression.ZipFile]::Open($temporaryZip, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($file in $files) {
            [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $archive, (Join-Path $repoRoot $file), $file, [System.IO.Compression.CompressionLevel]::Optimal
            )
        }
    } finally {
        $archive.Dispose()
    }
    if ($ReleaseNotesPath) {
        $notesPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ReleaseNotesPath)
        [System.IO.File]::WriteAllText($notesPath, $releaseNotes, [System.Text.UTF8Encoding]::new($false))
    }
    Move-Item -LiteralPath $temporaryZip -Destination $archivePath -Force
} finally {
    if (Test-Path -LiteralPath $temporaryZip -PathType Leaf) {
        Remove-Item -LiteralPath $temporaryZip -Force
    }
}

Write-Host "Built $archivePath"
[pscustomobject]@{
    Version = $releaseVersion
    ManifestVersion = $version
    Prerelease = $isPrerelease
    ArchivePath = $archivePath
}
