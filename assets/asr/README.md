# Speak ASR weights (browser)

`yueyu-whisper-small-onnx/` — merged Yueyu LoRA v2 (`whisper-small`), INT8 ONNX for `@xenova/transformers`.

Decoder is split into `.part*` chunks (<100MB) so GitHub accepts the files; Speak joins them into the Cache API before loading.

Research CER after merge: raw mean ≈ 1.10 on the v2b holdout (same as LoRA adapter).
