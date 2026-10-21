Technical Report · Yueyu Detecting ASR Adaptation

Sole author: Alice Chen (Chen Jiachen / Jiachen Chen)

Project: Yueyu Detecting (越语侦听)

Pilot: 2026-08-15 (n = 27, v2 size-matched) · Clean whole-play study: 2026-08-23 (n = 39 / n = 80)

Report consolidated: 2026-10-21

Deployed checkpoint: whisper-small-merged-blend-v10-a0.5 (INT8 ONNX, on-device)

Public adapter: ArikaisAllie/yueyu-whisper-small-lora-v1 (the deployed blend is merged locally from the v2 / v8b / v10 adapters)

中文摘要

研究问题： 在标注数据稀缺的条件下，能否用高质量音文对齐语料对开源 ASR（Whisper）做参数高效适配，稳定提升吴语越语／越剧唱念的识别，并在浏览器端私有部署？

方法： 从本站已校对时间轴档案切片成 16 kHz 单声道金标 → 按整剧划分训练 / 留出（杜绝同剧泄漏）→ 在 whisper-small 上做 LoRA（v1–v13）并在参数空间线性融合（model soup）→ 与同尺寸裸 whisper-tiny / whisper-small 比较未截断字错误率（CER）→ 导出 INT8 ONNX，浏览器端 WASM 本地推理。

规模： 7,836 切片，7,809 条通过金标门，约 668 分钟（训练 ≈ 605、测试 ≈ 67）；测试为《荆钗记》前段与全本未见《白兔记》 。已剔除音文不符与假时间轴两处来源，并人工听校最差 31 句（金标全部正确）。

结果。 早期 n = 27 试点：原始均值 CER tiny 7.31 / plain small 10.70 / LoRA v2 1.10（循环输出 2→0，长度合规 10/27→25/27），但 exact match 仍为 0。干净协议（8-23）均值 CER——线上 blend-v10：荆钗（见过的剧, n = 39）0.85、白兔（未见全剧, n = 80）1.18；实验室 v13（听校改时间轴后，未上线）：0.81 / 1.04。固定模型的纯解码对照（同一 whisper-small、同样 27 句、openai-whisper CPU fp32，仅改解码器）给出更诚实的结论：裸贪心 3.39（并非 HF pipeline 的 10.70），开启标准卫生后降到 1.91 并消掉唯一一次 ≥200 字循环，但中位数基本不动（1.13→1.25）、长度合规仍为 9/27——卫生只消除灾难性尾部，并不教会唱腔长度或内容；pilot 的 10.70→1.10 大部分是后端+解码而非权重。权重层面的严谨证据是同一评测管线内的干净全剧研究（白兔 3.35→1.04），详见 §5.1。

诚实结论： 适配主要修好了输出行为（消除退化循环、恢复唱句长度与语域），并在未见全剧上把相对同尺寸基线的均值 CER 降低约 2.17；但内容尚未转对（exact match 0、多数句子与参考答案零共同字）。8-23 主动设定"承认上限、双指标诚实"，保留稳健的 blend-v10 上线、不剔难句刷 0.5。

English abstract

Question. With scarce labeled data, can parameter-efficient adaptation of an open ASR (Whisper), built on high-quality aligned clips, reliably improve recognition of Shengzhou-Wu / Yue-opera speech — and be deployed privately in the browser?

Method. Slice corrected timed transcripts to 16 kHz mono gold; split by whole play so no play straddles train/test; LoRA-adapt whisper-small (v1–v13) and merge checkpoints in parameter space (a model soup); score unclipped character error rate (CER) against size-matched plain whisper-tiny / whisper-small; export INT8 ONNX for in-browser WASM inference.

Scale. 7,836 clips, 7,809 gold-OK (≈ 668 min) (train ≈ 605, test ≈ 67); test = early Jingchai plus the entirely unseen full play Baitu. Two unsound sources were removed and the 31 worst-scoring test cues were hand-checked (all gold confirmed).

Results. Early n = 27 pilot raw mean CER: tiny 7.31 / plain small 10.70 / LoRA v2 1.10 (runaways 2→0, length-conformant 10/27→25/27), with exact match still 0. Clean protocol (8-23) mean CER — deployed blend-v10: Jingchai (seen play, n = 39) 0.85, Baitu (unseen full play, n = 80) 1.18; laboratory v13 (after timing QA, not deployed): 0.81 / 1.04. A fixed-model decoding-only control (same whisper-small, same 27 cues, openai-whisper CPU fp32, decoder only) gives a more honest reading: loop-prone greedy scores 3.39 (not the HF pipeline's 10.70), and stock safeguards drop it to 1.91 and remove the only ≥200-char runaway, while median stays flat (1.13→1.25) and length conformance stays 9/27 — hygiene removes the catastrophic tail but does not teach opera length or content, so most of the pilot 10.70→1.10 was backend + decoding, not weights. The weight-level claim rests on the within-pipeline clean whole-play study (Baitu 3.35→1.04), detailed in §5.1.

Honest takeaway. Adaptation primarily fixes output behavior (no degenerate loops; correct sung-line length and register) and cuts mean CER on an unseen play by ≈ 2.17 over the size-matched baseline, but it does not yet transcribe content correctly (exact match 0; most cues share no character with the reference). On 8-23 the project explicitly chose to acknowledge this ceiling and keep the robust blend-v10 deployed rather than dropping hard cues to chase 0.5.

1. Goal

Yueyu (Shaoxing / Shengzhou-area Wu) and Yue-opera stage speech are low-resource for mainstream ASR: scarce public aligned data, register variation (散白 / 韵白 / 唱词), melisma-sustained syllables, and domain shift from Mandarin-centric training. Generic Whisper handles ordinary Mandarin but, run naively on opera clips, loops on sustained vowels and ignores sung length.

This study asks whether archive-quality timed transcripts curated for Yueyu Detecting can support a reproducible, honestly-measured adaptation of an open ASR model, and whether the result can be shipped on-device (no recognition server, audio never leaves the browser).

2. Method

2.1 Data pipeline

Timed cues in data/transcripts/*.json with a corrected/reviewed Chinese layer.
Export candidates via scripts/export-asr-gold.py → data/corpus/asr/gold-clips.jsonl.
Slice to 16 kHz mono wavs (scripts/asr/slice_clips.py, ffmpeg / imageio-ffmpeg).
Normalize references for scoring: traditional→simplified (OpenCC), strip punctuation/whitespace/non-target characters.
LoRA train (scripts/asr/train_whisper_lora.py), merge/blend (scripts/asr/merge_lora.py), evaluate CER (scripts/asr/eval_cer.py).

2.2 Why Whisper + LoRA + model soup

Whisper is a strong open multilingual baseline already familiar from upload demos, so it is a fair, reproducible reference.
LoRA adapts whisper-small with few trainable parameters, practical on a laptop/Colab T4 with a small gold set.
Checkpoint blending (model soup). No single checkpoint won everywhere: earlier adapters generalized better to the official holdout, later ones to new plays. Compatible adapters were merged as a convex combination W = (1−α)W_a + αW_b instead of overfitting to one test set. The deployed blend-v10-a0.5 is 0.5·(0.35·v2 + 0.65·v8b) + 0.5·v10.

2.3 Training setup

表格
Item	Value
Base model	openai/whisper-small
Adaptation	LoRA r = 16, α = 32, targets q_proj / v_proj, dropout 0.05
Optimization	lr 1e-4, batch 4, 200 steps, fp16, 16 kHz forced
Text	No automatic normalizer — Chinese characters learned verbatim
Decode (eval)	language=chinese, transcribe task, 30 s chunks, max_new_tokens = 444
Iterations	v1–v13, each logged separately in docs/YUEYU_ASR.md

2.4 Whole-play split

Random cue-level splitting would leak singer, accompaniment, recording, and recurring lines across train and test. The split is therefore by whole play. After the 2026-08-23 cleanup:

Test: jingchai-ji 荆钗记 early ≈ 5 min and baitu-ji 白兔记 as an entirely unseen full play.
Excluded from hard gold: he-wenxiu-suanming (sung words did not match the libretto) and xianglin-sao-xinsuanhua (grid/fabricated timestamps).
Label QA: the 31 worst-scoring Jingchai test cues were re-listened; all 31 confirmed correct, so residual errors are attributed to the model/domain, not bad labels.

3. Data summary (cleaned protocol, 2026-08-23)

表格
Set	Clips	Duration
All sliced	7,836	≈ 672.3 min
Gold-OK (used)	7,809	≈ 667.6 min
Train (gold-OK)	—	≈ 605.1 min
Test (gold-OK)	Jingchai 39 eval cues + Baitu 80-eval sample (384 Baitu clips in the split)	≈ 67.3 min
Pending review (excluded)	27	≈ 4.7 min

Raw manifest: data/corpus/asr/gold-summary.json. Register labels (散白 / 韵白 / 唱词) remain provisional heuristics; the study does not claim multi-hour native re-listening of every cue.

4. Pilot (n = 27, 2026-08-15)

4.1 Why multiple CER columns

jiwer raw CER can exceed 1.0 because a looping model inserts characters. The headline numbers are therefore unclipped; capped/clipped variants are logged alongside, plus median, worst case, a runaway count (hypotheses ≥ 400 characters, near the 444 cap), exact-match, and a length-conformance diagnostic (hypothesis character count within ±20% of the reference). Every adapted model is compared with size-matched whisper-tiny and plain whisper-small on identical clips.

4.2 Pilot v2 results (size-matched, decode max_new_tokens = 444)

表格
System	mean CER	median	worst	runaways ≥400 ch	length ±20%	exact
whisper-tiny (HF pipeline, greedy, safeguards off)	7.31	1.43	63.43	2	13/27	0
whisper-small (no LoRA; HF pipeline, greedy, safeguards off)	10.70	1.71	63.43	2	10/27	0
whisper-small + LoRA v1 (200 steps)	5.55	—	—	—	—	0
whisper-small + LoRA v2 (longer)	1.10	1.00	2.14	0	25/27	0

JSON: cer-v2b.json. Two plain-small outputs run to the 444-character cap, which is why its mean exceeds tiny's — the median and runaway count expose this. (The earlier pilot note that the post-adaptation worst CER was 1.0 was incorrect; the true worst is 2.14: 20 of 27 adapted cues sit at CER exactly 1.0, six remain above 1.0 through insertions, one is below at 0.71.)

4.3 What the pilot does and does not show

On 21 of the 27 cues the adapted output shares no character at all with the reference. A representative cue turns the seven-syllable 待我掐指细推算 ("let me divine it carefully") into 小姐姐 ("little miss") — right length and register, wrong words. The adapter learned to stop looping and emit line-length opera-register text, which is necessary but not sufficient for transcription. The defensible pilot claim is behavioral, not "10× more accurate content".

5. Clean whole-play study (2026-08-23)

5.1 Size-matched results

After corpus expansion, bad-source removal, and timing QA, the same size-matched baselines were rerun on whole-play splits.

表格
Held-out set	n	tiny	plain small	deployed blend-v10	lab v13 (not deployed)
荆钗记 Jingchai (seen play)	39	2.16	1.51	0.85 (Δ −0.66)	0.81
白兔记 Baitu (unseen full play)	80	3.55	3.35	1.18 (Δ −2.17)	1.04

JSON: cer-protocol-20260823-summary.json (deployed blend-v10), cer-protocol-20260823-v13-summary.json (post-QA v13). The small seen-vs-unseen gap (0.85 vs 1.18 for the deployed model) is evidence against pure memorization: the transfer to a play never seen in training roughly triples accuracy over generic small (3.35 → 1.18).

5.2 Decoding-only control (fixed model)

The pilot generic row (10.70) was produced through the Hugging Face pipeline with plain greedy decoding and all failure safeguards disabled (condition_on_previous_text=False, no temperature fallback, no compression check), whereas the adapted run used healthier decoding — a confound of weights, backend, and decoding. To isolate decoding, a fixed-model control decodes the same unadapted whisper-small checkpoint twice on the identical 27 cues using the reference openai-whisper backend (CPU fp32; MPS could not load the sparse alignment buffer on the author's Mac), changing only the decoder:

greedy_loop: temperature 0, all safeguards off (the loop-prone pilot setting);
default_hygiene: temperature-fallback tuple, compression_ratio_threshold = 2.4, condition_on_previous_text = True.

Cues and references match cer-v2b.json exactly; the run reads the frozen snapshot data/corpus/asr/gold-clips-v8-eval-oldholdout.jsonl, because the current gold-clips.jsonl marks these 27 rows goldOk:false after the 2026-08-23 protocol (the two he-wenxiu cues were demoted for lyrics/audio mismatch).

表格
Same whisper-small, only the decoder changes (n = 27)	mean CER	median	worst CER	runaways ≥200 ch	length ±20%	exact
greedy_loop (safeguards off)	3.39	1.13	31.86	1	9/27	0
default_hygiene	1.91	1.25	6.57	0	9/27	0
adapted LoRA v2 (different backend, for reference)	1.10	1.00	2.14	0	25/27	0

JSON: cer-decode-control.json, script eval_decode_control.py.

Three conclusions — the first is a correction.

Backend and decoding, not weights, explain most of the pilot headline. Re-running generic small in the reference openai-whisper backend with greedy decoding gives 3.39, not 10.70; the larger pilot figure is a Hugging Face pipeline artifact. Stock safeguards then drop 3.39 → 1.91 and remove the only ≥200-char runaway. The pilot 10.70 → 1.10 delta therefore cannot be read as a pure fine-tuning effect.
Decoding hygiene removes the catastrophic tail but does not fix recognition. Median is essentially flat (1.13 → 1.25) and length conformance does not move at all (9/27 → 9/27). The removed loop is he-wenxiu-suanming-11 (223 characters repeating a subtitle watermark "字幕君的…", CER 31.86 → a 7-character, CER 1.0 line). The companion cue he-wenxiu-suanming-10 does not loop in either arm (7 characters, CER 1.0 — so the HF-pipeline pilot saw 2 ≥400-char loops where the openai-whisper control sees one ≥200-char loop; the exact reproduction target was therefore only partially met).
The adapted model shows a distinct capability, but the clean weight-only evidence is the within-backend full-play study. The adapted pilot output reached 1.10 / 25-of-27 length-conformant versus hygienic generic 1.91 / 9-of-27 — suggestive, but cross-backend. The rigorous weight comparison is §5.1's clean study, where the same evaluator scores generic and adapted on seen and unseen full plays (Baitu 3.35 → 1.04). That result, not the pilot delta, carries the weight-level claim.

5.3 The ceiling decision (2026-08-23)

v12 → v13 improved mean CER by only ≈ 0.02, and hand QA confirmed the CER≈1 failures were not label errors. The author explicitly rejected dropping hard cues to report a vanity 0.5, kept the robust, cross-play-tested blend-v10 in production, and left v13 as a laboratory adapter pending real-field evidence. See ASR_CEILING_DECISION_20260823.md.

6. Deployment (on-device)

The merged blend is exported via transformers/Optimum to INT8 ONNX and served as static files; there is no ASR server.

表格
Component	File	Size
Encoder	onnx/encoder_model_quantized.onnx	92.2 MB
Decoder shard 0	onnx/decoder_model_quantized.onnx.part00	94.4 MB
Decoder shard 1	onnx/decoder_model_quantized.onnx.part01	60.4 MB
Total payload	assets/asr/yueyu-whisper-small-onnx/	≈ 247 MB

The decoder is split only for serving constraints; src/speak.ts joins the two parts in the transformers cache before pipeline construction. Inference runs on ONNX Runtime Web / WASM (no GPU required). MediaRecorder captures the mic and uploads are read locally; audio is resampled to 16 kHz mono and transcribed without leaving the device. Weights download and cache once (~15–30 s first recognition per the site's own copy); later recognitions can run offline. The earlier LoRA-v2-only export is superseded by this pack.

Alongside transcription, Speak runs (a) archive lyric retrieval against assets/speak/lyric-index.json (~2,500 lines) plus a lightweight speaker fingerprint, and (b) browser-side prosody/gist features; translation prefers archive candidate lines over a raw error-prone hypothesis.

7. Limits and interpretation

Content ≠ behavior. Exact match is 0 and most adapted cues share no character with the reference; the robust claim is elimination of loops + correct length/register plus a size-matched CER reduction, not fluent transcription.
Metric meaning against sung gold. References are short, stylized, and can legitimately diverge from what is sung (ornamentation, dialect pronunciation), so even a perfect recognizer may not reach zero.
Decoding/backend confound. Resolved by the §5.2 fixed-model control (cer-decode-control.json): reference-backend greedy is 3.39 (not the HF-pipeline 10.70), stock hygiene 1.91, and hygiene removes the loop without moving median or length conformance — so the pilot delta was largely backend/decoding, and the weight-level claim rests on the §5.1 within-pipeline full-play study.
Domain. Archive Yue-opera only. Spoken / broadcast Shengzhou Wu is a separate, not-yet-covered domain; no claim that opera LoRA transfers there.
Client cost. ~247 MB one-time download; a formal cross-device latency/RTF benchmark and a smaller distilled weight set are future work — no real-time-factor number is claimed yet.

What the study does show: an end-to-end, sole-author loop — curated archive → 668-minute audited whole-play corpus → size-matched v1–v13 adaptation and blending → unclipped honest metrics with a disclosed confound → INT8 ONNX on-device deployment.

8. Future work

Re-run the decoding control on GPU/MPS once the sparse-buffer issue is resolved (current control is CPU fp32); commit cer-decode-control.json alongside eval_decode_control.py.
Add a within-openai-whisper comparison of generic vs adapted (the control currently isolates decoding only; the pilot's adapted 1.10 is cross-backend).
Benchmark client latency across devices; distill a smaller ONNX weight set.
Grow gold with clearer 散白 / 韵白 / 唱词 tagging; add spoken/radio gold as a separate domain.
Continue listening-QA per piece before refreshing that piece's lyric index / fingerprints.
Optionally mirror the full ONNX pack to Hugging Face (scripts/asr/upload-onnx-hf.sh).

Operational log: YUEYU_ASR.md · Colab steps: scripts/asr/COLAB.md · Colab v1 (size-mismatched tiny 42.9 vs adapted 18.7) is retained there for history but is not the basis of any current claim.

Citation

See CITATION.cff. Prefer citing the live site and this repository. Public adapter: ArikaisAllie/yueyu-whisper-small-lora-v1; deployed checkpoint: whisper-small-merged-blend-v10-a0.5.
