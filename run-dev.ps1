# SMPMS Development Runner
# Opens frontend and backend in separate CMD windows with simultaneous kill option

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$frontendPath = Join-Path $projectRoot "frontend"
$backendPath = Join-Path $projectRoot "backend"

# Process handles for cleanup
$frontendJob = $null
$backendJob = $null

function Get-ScriptPath {
    $scriptPath = $PSCommandPath
    if (-not $scriptPath) {
        $scriptPath = $MyInvocation.ScriptName
    }
    return $scriptPath
}

function Start-Failed {
    Write-Host "`n[ERROR] Failed to start processes. Killing any running instances..." -ForegroundColor Red
    Stop-All
    exit 1
}

function Stop-All {
    Write-Host "`n[STOP] Shutting down all processes..." -ForegroundColor Yellow

    if ($frontendJob) {
        Write-Host "  -> Stopping Frontend (Vite)..." -ForegroundColor Cyan
        Stop-Job -Job $frontendJob -ErrorAction SilentlyContinue
        Remove-Job -Job $frontendJob -Force -ErrorAction SilentlyContinue
    }

    if ($backendJob) {
        Write-Host "  -> Stopping Backend (Node)..." -ForegroundColor Cyan
        Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
        Remove-Job -Job $backendJob -Force -ErrorAction SilentlyContinue
    }

    # Kill any remaining node processes started by this script
    $currentPid = $PID
    Get-CimInstance Win32_Process | Where-Object {
        $_.Name -eq "cmd.exe" -and $_.ProcessId -ne $currentPid
    } | ForEach-Object {
        try {
            $parentProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($_.ParentProcessId)"
            if ($parentProcess -and $parentProcess.ProcessId -eq $currentPid) {
                Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
            }
        } catch {}
    }

    Write-Host "[DONE] All processes stopped." -ForegroundColor Green
}

# Register cleanup on script exit
trap { Stop-All }

# Ctrl+C handler
$scriptPath = Get-ScriptPath
$null = [Console]::TreatControlCAsInput = $true

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SMPMS Development Environment" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "[INFO] Starting Frontend on http://localhost:5173" -ForegroundColor Green
Write-Host "[INFO] Starting Backend  on http://localhost:3000`n" -ForegroundColor Green

# Start Frontend in new CMD window
Start-Process -FilePath "cmd.exe" -ArgumentList "/k cd /d `"$frontendPath`" && npm run dev" -WindowStyle Normal -PassThru | Out-Null

# Start Backend in new CMD window
Start-Process -FilePath "cmd.exe" -ArgumentList "/k cd /d `"$backendPath`" && npm run dev" -WindowStyle Normal -PassThru | Out-Null

Write-Host "----------------------------------------" -ForegroundColor DarkGray
Write-Host "  Both servers are starting..." -ForegroundColor White
Write-Host "  Press Ctrl+C to stop both servers" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor DarkGray

# Wait for Ctrl+C
try {
    while ($true) {
        Start-Sleep -Seconds 1
        if ([Console]::KeyAvailable) {
            $key = [Console]::ReadKey($true)
            if ($key.Key -eq "C" -and $key.Modifiers -eq "Control") {
                Write-Host "`n`n[INPUT] Ctrl+C detected!" -ForegroundColor Yellow
                break
            }
        }
    }
} finally {
    Stop-All
}
