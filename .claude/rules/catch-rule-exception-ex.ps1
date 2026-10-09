<#
.SYNOPSIS
    Tự động sửa vi phạm trong catch (Exception ex) block của api/

.DESCRIPTION
    Quy tắc chuẩn:
      Add*.cs    → "Lỗi thêm dữ liệu."
      Update*.cs → "Lỗi cập nhật dữ liệu."
      Delete*.cs → "Lỗi xóa dữ liệu."
      Get*.cs    → "Lỗi truy xuất dữ liệu."
      Export*.cs    → "Lỗi xuất dữ liệu."
      Import*.cs    → "Lỗi nhập dữ liệu."
      Print*.cs    → "Lỗi in dữ liệu."
      LogErrorAsync("XxxHandler") phải khớp tên class Handler trong cùng file

.PARAMETER DryRun
    Chỉ báo cáo vi phạm, không ghi file

.PARAMETER ApiPath
    Đường dẫn thư mục api (mặc định: ../../api tính từ vị trí script)

.EXAMPLE
    # Xem trước
    pwsh -File catch-rule-exception-ex.ps1 -DryRun

    # Sửa thật
    pwsh -File catch-rule-exception-ex.ps1
#>
param(
    [switch]$DryRun,
    [string]$ApiPath = (Join-Path $PSScriptRoot "..\..\api")
)

# UTF-8 để hiển thị tiếng Việt đúng khi chạy từ cmd / bat
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8

$ErrorActionPreference = "Stop"
$totalFiles = 0

# ─────────────────────────────────────────────
# Quy tắc: prefix tên file → message đúng trong catch block
# Bất kỳ message nào khác sẽ tự động bị thay — không cần liệt kê từng cái sai
# ─────────────────────────────────────────────
$messageRules = @(
    [PSCustomObject]@{ Filter = "Add*.cs";    Correct = "Lỗi thêm dữ liệu." }
    [PSCustomObject]@{ Filter = "Update*.cs"; Correct = "Lỗi cập nhật dữ liệu." }
    [PSCustomObject]@{ Filter = "Delete*.cs"; Correct = "Lỗi xóa dữ liệu." }
    [PSCustomObject]@{ Filter = "Get*.cs";    Correct = "Lỗi truy xuất dữ liệu." }
    [PSCustomObject]@{ Filter = "Export*.cs"; Correct = "Lỗi xuất dữ liệu." }
    [PSCustomObject]@{ Filter = "Import*.cs"; Correct = "Lỗi nhập dữ liệu." }
    [PSCustomObject]@{ Filter = "Print*.cs";  Correct = "Lỗi in dữ liệu." }
)

$apiResponseRegex = 'return new ApiResponse\(true,\s*101,\s*"([^"]*)"'

# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────
function Read-FileLines($path) {
    $raw    = [System.IO.File]::ReadAllBytes($path)
    $text   = [System.Text.Encoding]::UTF8.GetString($raw)
    $ending = if ($text -match "`r`n") { "`r`n" } else { "`n" }
    return ($text -split "`r?`n"), $ending
}

function Write-FileLines($path, $lines, $ending) {
    [System.IO.File]::WriteAllBytes($path, [System.Text.Encoding]::UTF8.GetBytes($lines -join $ending))
}

function Get-RelPath($full) {
    $full.Replace((Resolve-Path $ApiPath).Path, "api").Replace("\", "/")
}

function Show-Result($filePath, $fixes, $modified) {
    if (-not $modified) { return }
    $rel = Get-RelPath $filePath
    if ($DryRun) { Write-Host "[DRY] $rel" -ForegroundColor Yellow }
    else         { Write-Host "[FIX] $rel" -ForegroundColor Green }
    $fixes | ForEach-Object { Write-Host $_ -ForegroundColor Cyan }
}

# ─────────────────────────────────────────────
# Pass 1: Sửa ApiResponse message trong catch (Exception ex) block
# Theo dõi cặp {} để chỉ thay bên trong catch, không đụng try block
# ─────────────────────────────────────────────
function Invoke-FixMessages($filePath, [string]$correctMessage) {
    $lines, $ending = Read-FileLines $filePath
    $modified = $false; $fixes = @()

    $depth = 0; $inCatch = $false; $catchDepth = -1

    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line   = $lines[$i]
        $opens  = ([regex]::Matches($line, '\{')).Count
        $closes = ([regex]::Matches($line, '\}')).Count

        if ($inCatch) {
            $newDepth = $depth + $opens - $closes
            if ($newDepth -le $catchDepth) {
                $inCatch = $false; $depth = $newDepth
            } else {
                if ($line -match $apiResponseRegex -and $Matches[1] -ne $correctMessage) {
                    $escaped   = [regex]::Escape($Matches[1])
                    $fixes    += "  Line $($i+1): `"$($Matches[1])`" → `"$correctMessage`""
                    $lines[$i] = [regex]::Replace($line, "return new ApiResponse\(true,\s*101,\s*`"$escaped`"", "return new ApiResponse(true, 101, `"$correctMessage`"")
                    $modified  = $true
                }
                $depth = $newDepth
            }
        } else {
            if ($line -match 'catch\s*\(Exception') { $catchDepth = $depth; $inCatch = $true }
            $depth += $opens - $closes
        }
    }

    Show-Result $filePath $fixes $modified
    if ($modified -and -not $DryRun) { Write-FileLines $filePath $lines $ending }
    return $modified
}

# ─────────────────────────────────────────────
# Pass 2: Sửa LogErrorAsync handler name
# Khớp tên với class Handler gần nhất phía trên trong cùng file
# ─────────────────────────────────────────────
function Invoke-FixLogErrorAsync($filePath) {
    $lines, $ending = Read-FileLines $filePath
    $modified = $false; $fixes = @()

    $handlers = @()
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match 'public class (\w+Handler)\b') {
            $handlers += [PSCustomObject]@{ Name = $Matches[1]; Start = $i }
        }
    }
    if ($handlers.Count -eq 0) { return $false }

    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -notmatch 'LogErrorAsync\("([^"]+)"') { continue }
        $currentName = $Matches[1]

        $ownerName = $handlers[0].Name
        foreach ($h in $handlers) { if ($i -ge $h.Start) { $ownerName = $h.Name } }

        if ($currentName -ne $ownerName) {
            $escaped   = [regex]::Escape($currentName)
            $lines[$i] = $lines[$i] -replace "LogErrorAsync\(`"$escaped`"", "LogErrorAsync(`"$ownerName`""
            $fixes    += "  Line $($i+1): `"$currentName`" → `"$ownerName`""
            $modified  = $true
        }
    }

    Show-Result $filePath $fixes $modified
    if ($modified -and -not $DryRun) { Write-FileLines $filePath $lines $ending }
    return $modified
}

# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
$resolvedApi = (Resolve-Path $ApiPath).Path
Write-Host ""
Write-Host "=== catch-rule-exception-ex ===" -ForegroundColor White
Write-Host "Mode : $(if ($DryRun) { 'DRY RUN' } else { 'FIX' })" -ForegroundColor $(if ($DryRun) { "Yellow" } else { "Green" })
Write-Host "Path : $resolvedApi"
Write-Host ""

Write-Host "--- Pass 1: ApiResponse messages ---" -ForegroundColor White
foreach ($rule in $messageRules) {
    foreach ($file in (Get-ChildItem -Recurse -Path $resolvedApi -Filter $rule.Filter)) {
        if (Invoke-FixMessages $file.FullName $rule.Correct) { $totalFiles++ }
    }
}

Write-Host ""
Write-Host "--- Pass 2: LogErrorAsync handler names ---" -ForegroundColor White
foreach ($file in (Get-ChildItem -Recurse -Path $resolvedApi -Filter "*.cs" | Where-Object { (Get-Content $_.FullName -Raw) -match 'LogErrorAsync\(' })) {
    if (Invoke-FixLogErrorAsync $file.FullName) { $totalFiles++ }
}

Write-Host ""
Write-Host "=== Kết quả ===" -ForegroundColor White
if ($DryRun) {
    Write-Host "Vi phạm phát hiện: $totalFiles file" -ForegroundColor Yellow
    Write-Host "Bỏ -DryRun để sửa thật." -ForegroundColor Yellow
} else {
    Write-Host "Đã sửa: $totalFiles file" -ForegroundColor Green
}
