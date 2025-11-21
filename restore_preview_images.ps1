# Script to restore preview image files from commit 2bb91c01c
# This will restore the category-specific fill-in graphics

$commit = "2bb91c01c"
$imageDir = "backend/static/images"

# List of preview image files to restore (based on backend/app.py PRODUCTS list)
$previewFiles = @(
    "testedpreview.png",
    "randompreview.png",
    "mensfittedtshirtpreview.png",
    "mensfittedlongsleevepreview.png",
    "guidonteepreview.png",
    "unisexoversizedtshirtpreview.png",
    "menslongsleevepreview.png",
    "hoodiechampionpreview.png",
    "croppedhoodiepreview.png",
    "womenstankpreview.png",
    "womensteepreview.png",
    "womensribbedneckpreview.png",
    "womensshirtpreview.png",
    "womenshdshirtpreview.png",
    "unisexpulloverhoodiepreview.png",
    "womenscroptoppreview.png",
    "kidhoodiepreview.png",
    "kidshirtpreview.png",
    "kidlongsleevepreview.png",
    "toddlershortsleevetpreview.png",
    "toddlerjerseytshirtpreview.png",
    "babystapletshirtpreview.png",
    "youthalloverprintswimsuitpreview.png",
    "kidssweatshirtpreview.png",
    "girlsleggingspreview.png",
    "laptopsleevepreview.png",
    "drawstringbagpreview.png",
    "crossbodybagpreview.png",
    "largecanvasbagpreview.png",
    "distresseddadhatpreview.png",
    "snapbackhatpreview.png",
    "fivepaneltruckerhatpreview.png",
    "youthbaseballcappreview.png",
    "mug1preview.png",
    "travelmugpreview.png",
    "enamalmugpreview.png",
    "coloredmugpreview.png",
    "dogbowlpreview.png",
    "scarfcollarpreview.png",
    "leashpreview.png",
    "collarpreview.png",
    "stickerspreview.png",
    "magnetpreview.png",
    "greetingcardpreview.png",
    "hardcovernotebookpreview.png",
    "coasterpreview.png",
    "apronpreview.png",
    "bandanapreview.png",
    "jigsawpuzzlepreview.png"
)

Write-Host "Restoring preview image files from commit $commit..." -ForegroundColor Cyan
Write-Host ""

$restoredCount = 0
$failedCount = 0

foreach ($file in $previewFiles) {
    $filePath = "$imageDir/$file"
    $fullPath = Join-Path $PSScriptRoot $filePath
    
    Write-Host "Restoring: $file" -NoNewline
    
    try {
        # Check if file exists in the commit
        $checkCmd = "git show $commit`:$filePath 2>&1"
        $checkResult = Invoke-Expression $checkCmd
        
        if ($LASTEXITCODE -eq 0 -and $checkResult -notmatch "fatal") {
            # File exists in commit, restore it
            $restoreCmd = "git show $commit`:$filePath > `"$fullPath`" 2>&1"
            $restoreResult = Invoke-Expression $restoreCmd
            
            if ($LASTEXITCODE -eq 0 -and (Test-Path $fullPath)) {
                Write-Host " - SUCCESS" -ForegroundColor Green
                $restoredCount++
            } else {
                Write-Host " - FAILED (restore error)" -ForegroundColor Red
                $failedCount++
            }
        } else {
            Write-Host " - SKIPPED (not in commit)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host " - FAILED (error: $_)" -ForegroundColor Red
        $failedCount++
    }
}

Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Restored: $restoredCount" -ForegroundColor Green
Write-Host "  Failed: $failedCount" -ForegroundColor Red
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Review the restored files"
Write-Host "  2. git add backend/static/images/*preview*.png"
Write-Host "  3. git commit -m 'Restore preview image graphics from commit 2bb91c01c'"
Write-Host "  4. git push origin main"
Write-Host "  5. Deploy backend to Fly.io"

