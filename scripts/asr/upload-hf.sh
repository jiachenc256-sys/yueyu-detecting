#!/usr/bin/env bash
# Upload lean LoRA adapter to Hugging Face.
# Usage:
#   export HF_TOKEN=hf_xxx
#   export HF_USER=your-username
#   ./scripts/asr/upload-hf.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DIR="$ROOT/data/corpus/asr/hf-upload/whisper-small-lora-v1"
REPO_NAME="${HF_REPO_NAME:-yueyu-whisper-small-lora-v1}"

if [[ -z "${HF_TOKEN:-}" ]]; then
  echo "Set HF_TOKEN first: https://huggingface.co/settings/tokens" >&2
  exit 1
fi
if [[ -z "${HF_USER:-}" ]]; then
  echo "Set HF_USER to your Hugging Face username" >&2
  exit 1
fi
if [[ ! -f "$DIR/adapter_model.safetensors" ]]; then
  echo "Missing $DIR/adapter_model.safetensors" >&2
  exit 1
fi

REPO_ID="$HF_USER/$REPO_NAME"
export REPO_ID
export DIR
echo "Uploading → $REPO_ID"

"$ROOT/.venv-asr/bin/pip" install -q huggingface_hub
"$ROOT/.venv-asr/bin/python" - <<'PY'
import os
from pathlib import Path
from huggingface_hub import HfApi, create_repo

token = os.environ["HF_TOKEN"]
repo_id = os.environ["REPO_ID"]
folder = Path(os.environ["DIR"])
api = HfApi(token=token)
create_repo(repo_id, repo_type="model", exist_ok=True, token=token, private=False)
api.upload_folder(
    folder_path=str(folder),
    repo_id=repo_id,
    repo_type="model",
    token=token,
    commit_message="Add Yueyu Whisper-small LoRA pilot v1 + model card",
)
print("https://huggingface.co/" + repo_id)
PY
