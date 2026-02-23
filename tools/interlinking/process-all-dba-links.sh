#!/bin/bash

echo "========================================"
echo "Processing All Microsites - DBA Cross-Linking"
echo "========================================"
echo ""

echo "[1/11] Processing chimney-repair..."
node suggest-dba-links.js --microsite chimney-repair --batch
echo ""

echo "[2/11] Processing siding-repair..."
node suggest-dba-links.js --microsite siding-repair --batch
echo ""

echo "[3/11] Processing crawlspace-rot..."
node suggest-dba-links.js --microsite crawlspace-rot --batch
echo ""

echo "[4/11] Processing leak-repair..."
node suggest-dba-links.js --microsite leak-repair --batch
echo ""

echo "[5/11] Processing flashing-repair..."
node suggest-dba-links.js --microsite flashing-repair --batch
echo ""

echo "[6/11] Processing trim-repair..."
node suggest-dba-links.js --microsite trim-repair --batch
echo ""

echo "[7/11] Processing beam-repair..."
node suggest-dba-links.js --microsite beam-repair --batch
echo ""

echo "[8/11] Processing dry-rot..."
node suggest-dba-links.js --microsite dry-rot --batch
echo ""

echo "[9/11] Processing lead-paint..."
node suggest-dba-links.js --microsite lead-paint --batch
echo ""

echo "[10/11] Processing restoration..."
node suggest-dba-links.js --microsite restoration --batch
echo ""

echo "[11/11] Processing deck-repair..."
node suggest-dba-links.js --microsite deck-repair --batch
echo ""

echo "========================================"
echo "All Sites Processed!"
echo "========================================"
echo ""
echo "Check dba-links-added.json for complete list"
