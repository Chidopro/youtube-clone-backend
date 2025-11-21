# Script to restore ALL preview image files from commit bbb5f425e
# This will restore the category-specific fill-in graphics for all products

$commit = "bbb5f425e"
$imageDir = "backend/static/images"

# All preview image files from backend/app.py PRODUCTS list
$previewFiles = @(
    "guidonteepreview.png",
    "mensfittedtshirtpreview.png",
    "unisexoversizedtshirtpreview.png",
    "randompreview.png",
    "mensfittedlongsleevepreview.png",
    "testedpreview.png",
    "croppedhoodiepreview.png",
    "hoodiechampionpreview.png",
    "womensribbedneckpreview.png",
    "womensshirtpreview.png",
    "womenshdshirtpreview.png",
    "kidshirtpreview.png",
    "kidhoodiepreview.png",
    "kidlongsleevepreview.png",
    "kidssweatshirtpreview.png",
    "youthalloverprintswimsuitpreview.png",
    "toddlerjerseytshirtpreview.png",
    "babystapletshirtpreview.png",
    "toddlershortsleevetpreview.png",
    "laptopsleevepreview.png",
    "drawstringbagpreview.png",
    "largecanvasbagpreview.png",
    "greetingcardpreview.png",
    "hardcovernotebookpreview.png",
    "coasterpreview.png",
    "apronpreview.png",
    "stickerspreview.png",
    "dogbowlpreview.png",
    "scarfcollarpreview.png",
    "bandanapreview.png",
    "jigsawpuzzlepreview.png",
    "leashpreview.png",
    "collarpreview.png",
    "magnetpreview.png",
    "menslongsleevepreview.png",
    "womenstankpreview.png",
    "unisexpulloverhoodiepreview.png",
    "womensteepreview.png",
    "distresseddadhatpreview.png",
    "snapbackhatpreview.png",
    "fivepaneltruckerhatpreview.png",
    "youthbaseballcappreview.png",
    "mug1preview.png",
    "travelmugpreview.png",
    "enamalmugpreview.png",
    "coloredmugpreview.png",
    "crossbodybagpreview.png",
    "womenscroptoppreview.png"
)

Write-Host "Restoring ALL preview image files from commit $commit..." -ForegroundColor Cyan
Write-Host "Total files to restore: $($previewFiles.Count)" -ForegroundColor Cyan
Write-Host ""

$restoredCount = 0
$failedCount = 0
$skippedCount = 0

foreach ($file in $previewFiles) {
    $filePath = "$imageDir/$file"
    $fullPath = Join-Path $PSScriptRoot $filePath
    
    Write-Host "Restoring: $file" -NoNewline
    
    try {
        # Check if file exists in the commit
        $checkResult = git show "$commit`:$filePath" 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            # File exists in commit, restore it
            git show "$commit`:$filePath" > $fullPath 2>&1
            
            if ($LASTEXITCODE -eq 0 -and (Test-Path $fullPath)) {
                Write-Host " - SUCCESS" -ForegroundColor Green
                $restoredCount++
            } else {
                Write-Host " - FAILED (restore error)" -ForegroundColor Red
                $failedCount++
            }
        } else {
            Write-Host " - SKIPPED (not in commit)" -ForegroundColor Yellow
            $skippedCount++
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
Write-Host "  Skipped: $skippedCount" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Review the restored files"
Write-Host "  2. git add backend/static/images/*preview*.png"
Write-Host "  3. git commit -m 'Restore all preview image graphics from commit bbb5f425e'"
Write-Host "  4. git push origin main"
Write-Host "  5. Deploy backend to Fly.io"

