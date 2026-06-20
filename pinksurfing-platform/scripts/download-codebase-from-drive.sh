#!/usr/bin/env bash
# Same as CodeBase/scripts/download-codebase-from-drive.sh — run from cloud after git clone
FILE_ID="13sYE8UQbxxdKzha44XPnIjdR4W6RMxD7"
OUT="${1:-CodeBase.zip}"
cd /workspace 2>/dev/null || cd ~
pip install -q gdown 2>/dev/null || python3 -m pip install --user gdown
gdown "$FILE_ID" -O "$OUT" --fuzzy || curl -L -o "$OUT" "https://drive.google.com/uc?export=download&id=${FILE_ID}"
unzip -q -o "$OUT" -d .
export PINKSURFING_ROOT=/workspace/CodeBase
[ -d "$PINKSURFING_ROOT" ] || export PINKSURFING_ROOT=/workspace
echo "PINKSURFING_ROOT=$PINKSURFING_ROOT"
bash "$PINKSURFING_ROOT/scripts/setup-cursor-cloud.sh" 2>/dev/null || true
bash "$PINKSURFING_ROOT/scripts/start-full-stack-linux.sh" 2>/dev/null || echo "Run start-full-stack-linux.sh after setup"
