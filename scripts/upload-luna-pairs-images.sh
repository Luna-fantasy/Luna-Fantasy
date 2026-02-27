#!/bin/bash
# Upload all LunaPairs images to Cloudflare R2
# Usage: bash scripts/upload-luna-pairs-images.sh

SRC_DIR="../LunaJester/images/LunaPairs"
BUCKET="assets"
PREFIX="LunaPairs"

if [ ! -d "$SRC_DIR" ]; then
  echo "Source directory not found: $SRC_DIR"
  exit 1
fi

COUNT=0
TOTAL=$(ls "$SRC_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')

echo "Uploading $TOTAL images to R2 bucket '$BUCKET' under '$PREFIX/'..."

for file in "$SRC_DIR"/*.png; do
  filename=$(basename "$file")
  COUNT=$((COUNT + 1))
  echo "[$COUNT/$TOTAL] $filename"
  npx wrangler r2 object put "$BUCKET/$PREFIX/$filename" --file="$file" --content-type="image/png" --remote
done

echo "Done. Uploaded $COUNT images."
