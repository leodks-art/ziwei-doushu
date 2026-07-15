#!/usr/bin/env bash
set -euo pipefail

DEST="${ZIWEI_SAMPLE_DEST:-/opt/ziwei-samples-v3}"
DOWNLOAD_DIR="$DEST/download"
ZIP="$DOWNLOAD_DIR/ziwei-samples-toolkit-v3-full.zip"
READY="$DEST/.ready"

cd "$DOWNLOAD_DIR"

cat > SHA256SUMS.expected <<'SUMS'
424b90ff4ef3cf67db0643515b3c62251f15b3cadd3b1414418e762c1c9369  ziwei-samples-v3-part1.zip.001
4a32ad023e265b5d6edc19fcb67752971333e5a822b5793c778cbb5f895a2bdf  ziwei-samples-v3-part2.zip.002
9628d6633123a78f67df4b9b3d49abfccfea72f8cdb936cd7bea24cdee89787e  ziwei-samples-v3-part3.zip.003
SUMS

sha256sum -c SHA256SUMS.expected
cat ziwei-samples-v3-part1.zip.001 ziwei-samples-v3-part2.zip.002 ziwei-samples-v3-part3.zip.003 > "$ZIP.tmp"
echo "21fe90f8737931c63397f38e419bbba6e839b7f8318440ccb747f9bb3e9b1870  $ZIP.tmp" | sha256sum -c -
mv "$ZIP.tmp" "$ZIP"

rm -rf "$DEST/ziwei-samples-toolkit"
unzip -q "$ZIP" -d "$DEST"

sample_count="$(find "$DEST/ziwei-samples-toolkit/samples-out" -name '*.jsonl.gz' | wc -l | tr -d ' ')"
if [ "$sample_count" != "720" ]; then
  echo "Expected 720 sample shard files, got $sample_count" >&2
  exit 1
fi

date -Iseconds > "$READY"
rm -f ziwei-samples-v3-part1.zip.001 ziwei-samples-v3-part2.zip.002 ziwei-samples-v3-part3.zip.003 "$ZIP"
pm2 restart ziwei-sample-bridge --update-env >/dev/null
pm2 save >/dev/null
echo "Samples ready at $DEST"
