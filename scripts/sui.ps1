param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$localSui = Join-Path $repoRoot ".local-tools\\sui\\bin\\sui.exe"

if (-not (Test-Path -LiteralPath $localSui)) {
    Write-Error "Local Sui CLI not found at $localSui"
    exit 1
}

& $localSui @Args
exit $LASTEXITCODE
