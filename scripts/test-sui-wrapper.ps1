$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$wrapper = Join-Path $PSScriptRoot "sui.ps1"
$powershell = Join-Path $PSHOME "powershell.exe"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("noflake-sui-wrapper-" + [System.Guid]::NewGuid())

function Assert-Equal {
    param(
        [object]$Expected,
        [object]$Actual,
        [string]$Message
    )

    if ($Expected -ne $Actual) {
        throw "$Message`: expected '$Expected', got '$Actual'"
    }
}

function Assert-Contains {
    param(
        [string]$Expected,
        [string]$Actual,
        [string]$Message
    )

    $normalizedExpected = [System.Text.RegularExpressions.Regex]::Replace($Expected, "\s+", "")
    $normalizedActual = [System.Text.RegularExpressions.Regex]::Replace($Actual, "\s+", "")
    if (-not $normalizedActual.Contains($normalizedExpected)) {
        throw "$Message`: expected output to contain '$Expected', got '$Actual'"
    }
}

function New-FakeSui {
    param(
        [string]$Directory,
        [string]$Version,
        [int]$CommandExitCode = 0
    )

    New-Item -ItemType Directory -Force -Path $Directory | Out-Null
    $fakeSui = Join-Path $Directory "sui.cmd"
    @"
@echo off
if "%~1"=="--version" (
  echo sui $Version
  exit /b 0
)
echo ARGS:%*
exit /b $CommandExitCode
"@ | Set-Content -LiteralPath $fakeSui -Encoding Ascii
}

function Invoke-Wrapper {
    param(
        [string]$Path,
        [string[]]$Arguments
    )

    $quotedArguments = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$wrapper`"") +
        ($Arguments | ForEach-Object { "`"$_`"" })
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $powershell
    $startInfo.Arguments = $quotedArguments -join " "
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.EnvironmentVariables["PATH"] = $Path

    $process = [System.Diagnostics.Process]::Start($startInfo)
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    return @{
        ExitCode = $process.ExitCode
        Output = ($stdout + $stderr).Trim()
    }
}

try {
    $matchingBin = Join-Path $tempRoot "matching"
    New-FakeSui -Directory $matchingBin -Version "1.73.0-test"
    $result = Invoke-Wrapper -Path $matchingBin -Arguments @("client", "active-env")
    Assert-Equal 0 $result.ExitCode "uses PATH-resolved system sui"
    Assert-Contains "ARGS:client active-env" $result.Output "forwards arguments to PATH-resolved system sui"

    $mismatchedBin = Join-Path $tempRoot "mismatched"
    New-FakeSui -Directory $mismatchedBin -Version "1.72.2-test"
    $result = Invoke-Wrapper -Path $mismatchedBin -Arguments @("client", "active-env")
    Assert-Equal 1 $result.ExitCode "returns failure for mismatched system sui"
    Assert-Contains "does not match required version 1.73.0" $result.Output "rejects mismatched system sui"

    $failingBin = Join-Path $tempRoot "failing"
    New-FakeSui -Directory $failingBin -Version "1.73.0-test" -CommandExitCode 7
    $result = Invoke-Wrapper -Path $failingBin -Arguments @("client", "active-env")
    Assert-Equal 7 $result.ExitCode "returns child process exit code"

    Write-Output "PASS: system Sui CLI wrapper tests"
}
finally {
    if (Test-Path -LiteralPath $tempRoot) {
        $resolvedTempRoot = (Resolve-Path -LiteralPath $tempRoot).Path
        $systemTempRoot = [System.IO.Path]::GetTempPath()
        if (-not $resolvedTempRoot.StartsWith($systemTempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to remove unexpected temp path: $resolvedTempRoot"
        }
        Remove-Item -LiteralPath $resolvedTempRoot -Recurse -Force
    }
}
