# Corpus intake (Baidu / local packs)

Use this workflow for large Yueju packs you acquire privately (e.g. 百度网盘 orders).  
**Do not commit raw video/audio packs to git.** Keep them local; publish only curated text + short rights-cleared clips later.

## Drop folder

Put downloaded packs here:

```text
~/Desktop/linguilistic project/baidu-yueju/
  videos/          ← 越剧视频 pack
  audio-or-tracks/ ← 越剧-1451首 pack (or nested folders as downloaded)
  _inventory/      ← generated listings (optional)
```

Then run:

```bash
make corpus-inventory
```

This writes `data/corpus/inventory.json` (paths + sizes only; safe to commit if you want a catalog without media).

## Academic use rules

| OK | Not OK |
|----|--------|
| Private research / school analysis | Uploading full purchased packs to public GitHub |
| Extracting audio locally for ASR | Redistributing Baidu share links in public docs |
| Selecting a small starter set (5–10 pieces) | Claiming stage 韵白 = everyday 绍兴话 without labels |

## What to label per piece

Copy [`data/corpus/manifest.example.json`](../data/corpus/manifest.example.json) to:

`data/corpus/manifests/<piece-id>.json`

Required fields:

- `id` — kebab-case id  
- `title` / `titleEn`  
- `sourceLocalPath` — path under the Desktop drop folder  
- `speechTypes` — any of `sanbai` (散白), `yunbai` (韵白), `changci` (唱词)  
- `school` — 流派 if known (e.g. 尹派)  
- `rights` — `private-research` until you clear redistribution  

## Starter set (recommended)

After download, pick **5–10** pieces that include:

1. Clear dialogue (散白)  
2. At least some 韵白  
3. Different plays / singers if possible  

Then we will:

1. Extract audio  
2. Build timed transcripts  
3. Merge into the multilingual viewer like 新龙门客寨  

## Commands

```bash
make corpus-setup      # create Desktop drop folders
make corpus-inventory  # scan downloads → data/corpus/inventory.json
make corpus-status     # show counts / readiness
```
