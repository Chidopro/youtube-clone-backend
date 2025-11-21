@echo off
echo Restoring preview images from commit 2bb91c01c...
echo.

cd backend\static\images

git show 2bb91c01c:backend/static/images/croppedhoodiepreview.png > croppedhoodiepreview.png
git show 2bb91c01c:backend/static/images/womensribbedneckpreview.png > womensribbedneckpreview.png
git show 2bb91c01c:backend/static/images/womensshirtpreview.png > womensshirtpreview.png
git show 2bb91c01c:backend/static/images/womenshdshirtpreview.png > womenshdshirtpreview.png
git show 2bb91c01c:backend/static/images/womenstankpreview.png > womenstankpreview.png
git show 2bb91c01c:backend/static/images/womensteepreview.png > womensteepreview.png
git show 2bb91c01c:backend/static/images/womenscroptoppreview.png > womenscroptoppreview.png
git show 2bb91c01c:backend/static/images/unisexpulloverhoodiepreview.png > unisexpulloverhoodiepreview.png

echo.
echo Done! Review the files, then:
echo 1. cd ..\..\..
echo 2. git add backend/static/images/*preview*.png
echo 3. git commit -m "Restore preview image graphics"
echo 4. git push origin main
echo 5. Deploy backend to Fly.io

pause

