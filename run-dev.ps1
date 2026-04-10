# SMPMS Development Runner (Ultimate Refactor)
# -------------------------------------------
# Features:
# - Starts frontend & backend in separate CMD windows
# - Clean shutdown (kills full process tree)
# - Restart with R / r
# - Ctrl+C exits everything cleanly
# - Path validation + stability improvements

$ErrorActionPreference = "Stop"

# ---------------------------------------
# PATH SETUP
# ---------------------------------------
$projectRoot = $PSScriptRoot
$frontendPath = Join-Path $projectRoot "frontend"
$backendPath  = Join-Path $projectRoot "backend"

# ---------------------------------------
# GLOBAL PROCESS HANDLES
# ---------------------------------------
$global:frontendProcess = $null
$global:backendProcess  = $null

# ---------------------------------------
# VALIDATE PATHS
# ---------------------------------------
function Validate-Paths {
    Write-Host "[CHECK] Validating project structure..." -ForegroundColor Cyan

    if (!(Test-Path $frontendPath)) {
        Write-Host "[ERROR] Frontend path not found: $frontendPath" -ForegroundColor Red
        exit 1
    }

    if (!(Test-Path $backendPath)) {
        Write-Host "[ERROR] Backend path not found: $backendPath" -ForegroundColor Red
        exit 1
    }

    Write-Host "[OK] Paths validated." -ForegroundColor Green
}

# ---------------------------------------
# START SERVERS
# ---------------------------------------
function Start-Servers {
    Write-Host "`n[START] Launching development servers..." -ForegroundColor Cyan

    # Frontend
    Write-Host "  -> Frontend: http://localhost:5173" -ForegroundColor Green
    $global:frontendProcess = Start-Process "cmd.exe" `
        -ArgumentList "/k cd /d `"$frontendPath`" && npm run dev" `
        -PassThru

    # Backend
    Write-Host "  -> Backend : http://localhost:3000" -ForegroundColor Green
    $global:backendProcess = Start-Process "cmd.exe" `
        -ArgumentList "/k cd /d `"$backendPath`" && npm run dev" `
        -PassThru
}

# ---------------------------------------
# STOP SERVERS (KILL FULL TREE)
# ---------------------------------------
function Stop-Servers {
    Write-Host "`n[STOP] Shutting down servers..." -ForegroundColor Yellow

    if ($frontendProcess -and !$frontendProcess.HasExited) {
        Write-Host "  -> Killing Frontend tree..." -ForegroundColor Cyan
        cmd /c "taskkill /PID $($frontendProcess.Id) /T /F" | Out-Null
    }

    if ($backendProcess -and !$backendProcess.HasExited) {
        Write-Host "  -> Killing Backend tree..." -ForegroundColor Cyan
        cmd /c "taskkill /PID $($backendProcess.Id) /T /F" | Out-Null
    }

    # Optional safety (uncomment if needed)
    # Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

    $global:frontendProcess = $null
    $global:backendProcess  = $null

    Write-Host "[DONE] All servers stopped." -ForegroundColor Green
}

# ---------------------------------------
# RESTART SERVERS
# ---------------------------------------
function Restart-Servers {
    Write-Host "`n[RESTART] Restarting servers..." -ForegroundColor Magenta

    Stop-Servers

    # Allow ports/process cleanup
    Start-Sleep -Seconds 2

    Start-Servers
}

# ---------------------------------------
# CLEAN EXIT HANDLER
# ---------------------------------------
trap {
    Stop-Servers
    exit
}

# ---------------------------------------
# UI HEADER
# ---------------------------------------
Clear-Host

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SMPMS Development Environment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# ---------------------------------------
# RUN
# ---------------------------------------
Validate-Paths
Start-Servers

Write-Host "`n----------------------------------------" -ForegroundColor DarkGray
Write-Host " Controls:" -ForegroundColor White
Write-Host "   Ctrl + C  -> Stop all servers" -ForegroundColor Yellow
Write-Host "   R / r     -> Restart servers" -ForegroundColor Yellow
Write-Host "----------------------------------------`n" -ForegroundColor DarkGray

# Enable key capture
[Console]::TreatControlCAsInput = $true

# ---------------------------------------
# INPUT LOOP
# ---------------------------------------
try {
    while ($true) {
        Start-Sleep -Milliseconds 200

        if ([Console]::KeyAvailable) {
            $key = [Console]::ReadKey($true)

            # Ctrl+C
            if ($key.Key -eq "C" -and $key.Modifiers -eq "Control") {
                Write-Host "`n[INPUT] Ctrl+C detected!" -ForegroundColor Yellow
                break
            }

            # Restart (R or r)
            if ($key.Key -eq "R") {
                Restart-Servers
            }
        }
    }
}
finally {
    Stop-Servers
}
