param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$moveManifest = Join-Path $repoRoot "contracts\\Move.toml"
$compilerVersionMatch = Select-String -LiteralPath $moveManifest -Pattern '^\s*compiler-version\s*=\s*"(?<version>\d+\.\d+\.\d+)"\s*$' |
    Select-Object -First 1

if (-not $compilerVersionMatch) {
    Write-Error "Unable to read compiler-version from $moveManifest"
    exit 1
}

$requiredVersion = $compilerVersionMatch.Matches[0].Groups["version"].Value
$systemSui = Get-Command sui -CommandType Application -ErrorAction SilentlyContinue |
    Select-Object -First 1

if (-not $systemSui) {
    Write-Error "System Sui CLI not found in PATH. Install Sui CLI $requiredVersion before running this script."
    exit 1
}

$versionOutput = (& $systemSui.Source --version 2>&1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $versionOutput -notmatch '\b(?<version>\d+\.\d+\.\d+)\b') {
    Write-Error "Unable to determine system Sui CLI version from '$($systemSui.Source)': $versionOutput"
    exit 1
}

$actualVersion = $Matches["version"]
if ($actualVersion -ne $requiredVersion) {
    Write-Error "System Sui CLI version $actualVersion does not match required version $requiredVersion from $moveManifest"
    exit 1
}

& $systemSui.Source @Args
exit $LASTEXITCODE
