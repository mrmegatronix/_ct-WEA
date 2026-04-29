Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "      SYSTEM GITHUB AUTO-SYNC TOOL       " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

Write-Host "Syncing all files..." -ForegroundColor Yellow

git add .
git commit -m "Auto-saved environment update ($(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))"
git push origin main

Write-Host "`nChanges pushed to GitHub successfully." -ForegroundColor Green
Write-Host "`nAll operations complete! Press any key to exit..." -ForegroundColor White
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
