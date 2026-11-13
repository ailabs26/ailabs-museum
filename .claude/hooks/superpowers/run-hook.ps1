#requires -Version 5.1
param(
    [Parameter(Position = 0)]
    [AllowEmptyString()]
    [string]$HookName = '',

    [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
    [AllowEmptyCollection()]
    [AllowEmptyString()]
    [string[]]$HookArguments = @()
)

$ErrorActionPreference = 'Stop'

function Stop-HookLaunch {
    param([string]$Message)
    [Console]::Error.WriteLine("run-hook.cmd: $Message")
    exit 1
}

function ConvertTo-NativeArgument {
    param(
        [AllowEmptyString()]
        [string]$Value
    )

    $builder = New-Object Text.StringBuilder
    [void]$builder.Append('"')
    $backslashCount = 0
    foreach ($character in $Value.ToCharArray()) {
        if ($character -eq '\') {
            $backslashCount++
            continue
        }
        if ($character -eq '"') {
            for ($index = 0; $index -lt (($backslashCount * 2) + 1); $index++) {
                [void]$builder.Append('\')
            }
            [void]$builder.Append('"')
            $backslashCount = 0
            continue
        }
        for ($index = 0; $index -lt $backslashCount; $index++) {
            [void]$builder.Append('\')
        }
        $backslashCount = 0
        [void]$builder.Append($character)
    }
    for ($index = 0; $index -lt ($backslashCount * 2); $index++) {
        [void]$builder.Append('\')
    }
    [void]$builder.Append('"')
    return $builder.ToString()
}

if ([string]::IsNullOrWhiteSpace($HookName) -or $HookName -notmatch '^[A-Za-z0-9][A-Za-z0-9_-]*$') {
    Stop-HookLaunch 'invalid script name'
}

$hookRoot = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')
$hookPath = [IO.Path]::GetFullPath((Join-Path $hookRoot $HookName))
if ((Split-Path -Parent $hookPath) -ne $hookRoot -or [IO.Path]::GetFileName($hookPath) -ne $HookName) {
    Stop-HookLaunch 'script path is outside the hook directory'
}
if (-not (Test-Path -LiteralPath $hookPath -PathType Leaf)) {
    Stop-HookLaunch 'hook not found'
}
$hookItem = Get-Item -LiteralPath $hookPath -Force -ErrorAction Stop
if (($hookItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    Stop-HookLaunch 'hook reparse points are not allowed'
}

$bashPath = $null
$bashCandidates = @()
if (-not [string]::IsNullOrWhiteSpace($env:ProgramFiles)) {
    $bashCandidates += Join-Path $env:ProgramFiles 'Git\bin\bash.exe'
}
$programFilesX86 = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
if (-not [string]::IsNullOrWhiteSpace($programFilesX86)) {
    $bashCandidates += Join-Path $programFilesX86 'Git\bin\bash.exe'
}
foreach ($candidate in $bashCandidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
        $bashPath = $candidate
        break
    }
}
if (-not $bashPath) {
    $bashCommand = Get-Command bash.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($bashCommand) { $bashPath = $bashCommand.Source }
}
if (-not $bashPath) {
    exit 0
}

$nativeArguments = @($hookPath)
if ($HookArguments.Count -gt 0) { $nativeArguments += $HookArguments }
$startInfo = New-Object Diagnostics.ProcessStartInfo
$startInfo.FileName = $bashPath
$startInfo.Arguments = (@($nativeArguments | ForEach-Object { ConvertTo-NativeArgument -Value ([string]$_) }) -join ' ')
$startInfo.WorkingDirectory = $hookRoot
$startInfo.UseShellExecute = $false
try {
    $process = [Diagnostics.Process]::Start($startInfo)
    $process.WaitForExit()
    exit $process.ExitCode
} catch {
    Stop-HookLaunch $_.Exception.Message
}
