# Atlas Second Brain Auto-Sync Watcher
# Periodically pulls new commits from GitHub into the local Obsidian vault.

$repoDir = "D:\YandexDisk\Atlas\second-brain"
Set-Location $repoDir

Write-Host "Starting Second Brain Auto-Sync Watcher..." -ForegroundColor Cyan
Write-Host "Target Vault: $repoDir" -ForegroundColor DarkGray

while ($true) {
    try {
        $status = git pull --ff-only 2>&1
        if ($status -match "Updating" -or $status -match "Fast-forward") {
            $time = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
            Write-Host "[$time] New memory updates pulled from GitHub into Obsidian Vault!" -ForegroundColor Green
            Write-Host $status -ForegroundColor DarkGray
        }
    } catch {
        # Silent ignore transient network hiccups
    }
    Start-Sleep -Seconds 30
}
