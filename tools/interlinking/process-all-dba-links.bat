@echo off
echo ========================================
echo Processing All Microsites - DBA Cross-Linking
echo ========================================
echo.

echo [1/10] Processing chimney-repair...
node suggest-dba-links.js --microsite chimney-repair --batch
echo.

echo [2/10] Processing siding-repair...
node suggest-dba-links.js --microsite siding-repair --batch
echo.

echo [3/10] Processing crawlspace-rot...
node suggest-dba-links.js --microsite crawlspace-rot --batch
echo.

echo [4/10] Processing leak-repair...
node suggest-dba-links.js --microsite leak-repair --batch
echo.

echo [5/10] Processing flashing-repair...
node suggest-dba-links.js --microsite flashing-repair --batch
echo.

echo [6/10] Processing trim-repair...
node suggest-dba-links.js --microsite trim-repair --batch
echo.

echo [7/10] Processing beam-repair...
node suggest-dba-links.js --microsite beam-repair --batch
echo.

echo [8/10] Processing dry-rot...
node suggest-dba-links.js --microsite dry-rot --batch
echo.

echo [9/10] Processing lead-paint...
node suggest-dba-links.js --microsite lead-paint --batch
echo.

echo [10/10] Processing restoration...
node suggest-dba-links.js --microsite restoration --batch
echo.

echo [11/11] Processing deck-repair...
node suggest-dba-links.js --microsite deck-repair --batch
echo.

echo ========================================
echo All Sites Processed!
echo ========================================
echo.
echo Check dba-links-added.json for complete list
pause
