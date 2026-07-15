#!/usr/bin/env bash
set -euo pipefail

DEST="${ZIWEI_SAMPLE_DEST:-/opt/ziwei-samples-v3}"
DOWNLOAD_DIR="$DEST/download"
ZIP="$DOWNLOAD_DIR/ziwei-samples-toolkit-v3-full.zip"
READY="$DEST/.ready"

mkdir -p "$DOWNLOAD_DIR"
cd "$DOWNLOAD_DIR"

cat > SHA256SUMS.expected <<'SUMS'
424b90ff4ef3cf67db0643515b3c62251f15bdb3cadd3b1414418e762c1c9369  ziwei-samples-v3-part1.zip.001
4a32ad023e265b5d6edc19fcb67752971333e5a822b5793c778cbb5f895a2bdf  ziwei-samples-v3-part2.zip.002
9628d6633123a78f67df4b9b3d49abfccfea72f8cdb936cd7bea24cdee89787e  ziwei-samples-v3-part3.zip.003
SUMS

download() {
  local url="$1"
  local out="$2"
  aria2c \
    --continue=true \
    --max-connection-per-server=16 \
    --split=16 \
    --min-split-size=1M \
    --max-tries=0 \
    --retry-wait=10 \
    --timeout=60 \
    --connect-timeout=30 \
    --summary-interval=60 \
    --dir="$DOWNLOAD_DIR" \
    --out="$out" \
    "$url"
}

download "https://github.com/Renhuai123/ziwei-doushu/releases/download/v3.0-samples/ziwei-samples-v3-part1.zip.001" "ziwei-samples-v3-part1.zip.001"
download "https://github.com/Renhuai123/ziwei-doushu/releases/download/v3.0-samples/ziwei-samples-v3-part2.zip.002" "ziwei-samples-v3-part2.zip.002"
download "https://github.com/Renhuai123/ziwei-doushu/releases/download/v3.0-samples/ziwei-samples-v3-part3.zip.003" "ziwei-samples-v3-part3.zip.003"

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
echo "Samples ready at $DEST"
