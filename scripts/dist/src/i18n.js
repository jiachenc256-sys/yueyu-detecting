/** Site UI language: Simplified Chinese / Traditional Chinese / English. */
const STORAGE_KEY = "yueyu-ui-locale";
const zhHans = {
    "meta.title": "越语侦听",
    "nav.home": "首页",
    "nav.speak": "听说翻译",
    "nav.tanci": "弹词",
    "nav.archive": "档案",
    "nav.story": "故事",
    "nav.plan": "计划",
    "nav.about": "关于",
    "nav.main": "主导航",
    "nav.lang": "界面语言",
    "brand.sub": "越语语音识别与档案",
    "home.headline": "听懂越语对话，用中文与英文读懂它。",
    "home.support": "先看三步用法，再进入听说翻译、弹词图片识别或对话档案。",
    "home.how1Title": "选一条路",
    "home.how1Body": "听说翻译：说话或上传音频；弹词：上传刻本图片识别文字；档案：听精选戏曲并读剧情。",
    "home.how2Title": "看三种文字",
    "home.how2Body": "识别后自动出现简体、繁體与 English；档案页也可切换。",
    "home.how3Title": "点时间即跳转",
    "home.how3Body": "在档案里点击时间戳，音频会跳到那一行并播放。",
    "home.ctaSpeak": "开始听说翻译",
    "home.ctaTanci": "打开弹词识别",
    "home.ctaArchive": "打开档案",
    "home.ctaStory": "我们如何做成",
    "tanci.title": "弹词 · 图片文字识别",
    "tanci.lead": "上传弹词刻本图片，调用姊妹项目 Talcne 的 OCR 后端，校对后可导出 JSON。",
    "tanci.note": "本页只做图片识别（无麦克风）。需本机或已部署的 Talcne 后端（默认 http://127.0.0.1:8000）。语音请用「听说翻译」。",
    "tanci.apiLabel": "Talcne 后端地址",
    "tanci.apiPlaceholder": "http://127.0.0.1:8000",
    "tanci.chooseImage": "选择图片",
    "tanci.recognize": "开始识别文字",
    "tanci.exportJson": "导出 JSON（档案桥）",
    "tanci.clear": "清除",
    "tanci.ready": "已就绪。选择清晰刻本图片后点击识别。",
    "tanci.preview": "图片预览",
    "tanci.previewEmpty": "尚未选择图片",
    "tanci.result": "识别结果（可编辑）",
    "tanci.editHint": "校对后可导出 JSON，再用本仓库 import 脚本写入档案。",
    "tanci.placeholder": "OCR 文字会出现在这里…",
    "tanci.status.selected": "已选择 {n} 张图片。点击「开始识别文字」。",
    "tanci.status.progress": "识别中…",
    "tanci.status.progressMulti": "识别中…（{n}/{total}）",
    "tanci.status.done": "识别完成。可在下方校对，或导出 JSON。",
    "tanci.status.fail": "识别失败",
    "tanci.status.exported": "已下载 JSON。可用 scripts/import-talcne-export.mjs 导入档案。",
    "story.title": "故事 · 我们为何做、如何做成",
    "story.lead": "把吴语里听得见的话——尤其是长辈与日常的声音——变成年轻人和外人也能跟读的档案。",
    "story.whyTitle": "为什么重要",
    "story.whyBody": "吴语社区正在变薄：许多老人仍用家乡话过日子，舞台上的越剧、书场里的弹词、广播里的口音，却越来越少被下一代听懂。越语侦听想留下可对读的声音样本——不夸大抢救，只认真记录，尤其珍视长辈与女性日常说话人的声音。",
    "story.originTitle": "问题从哪里来",
    "story.originBody": "方言流失之外，还有一道缝：台上的韵白、散白与街上的口语并不相同。年轻人或外人往往能“听热闹”，却读不出字句。我们从越剧切入，也把弹词文字层与广播口语放进同一张地图，让对话既听得见，也读得懂。",
    "story.s1Title": "收集与整理",
    "story.s1Body": "从本地戏曲、弹词相关文本与广播选段出发，建立清单与精选片段，而不是把整包音频丢上公网。",
    "story.s2Title": "转写与翻译",
    "story.s2Body": "为选段加上时间轴、说话人、简体 / 繁體 / English，并写清剧情简介，让不懂戏的人也能跟得上。",
    "story.s3Title": "真人试听检验",
    "story.s3Body": "请熟悉方言或戏曲的长辈与本地说话人试听、试说，对照识别结果是否“说得通、听得懂”。",
    "story.s4Title": "用档案反哺识别",
    "story.s4Body": "把校对过的语料当作训练与评测依据，让听说翻译从“普通话基线”慢慢靠近越语与吴语现场。",
    "story.note": "当前识别仍是基线演示。故事的重点是方法与动机：听见吴语、读懂对话、请真人检验，再慢慢改进——而不是假装已经完美。",
    "speak.title": "听说 → 识别 → 翻译",
    "speak.lead": "使用麦克风或上传音频。稍候即可看到简体中文、繁體中文与 English。",
    "speak.note": "实时麦克风使用浏览器语音引擎（推荐 Chrome / Edge）。上传文件使用设备端 Whisper（首次会下载小模型）。越语 / 舞台方言准确度会随档案语料积累而提升。",
    "speak.mic": "麦克风",
    "speak.upload": "上传音频",
    "speak.start": "开始听写",
    "speak.stop": "停止听写",
    "speak.micLang": "麦克风语言",
    "speak.chooseFile": "选择音频文件",
    "speak.clear": "清除",
    "speak.fileHint": "支持 MP3 / WAV / M4A · 短片段演示效果更好",
    "speak.ready": "已就绪。可用麦克风或上传音频——识别后会很快出现翻译。",
    "speak.recognized": "识别结果",
    "speak.editHint": "可编辑——改正后翻译会自动刷新。",
    "speak.placeholder": "识别到的对话会出现在这里…",
    "speak.outHans": "简体中文",
    "speak.outHant": "繁體中文",
    "speak.outEn": "English",
    "archive.title": "对话档案",
    "archive.lead": "本地语料精选档案——每条作品含简体 / 繁體 / English。点击时间戳即可跳转播放。",
    "archive.add": "添加剧目",
    "archive.badgeStarter": "精选",
    "archive.badgeMulti": "多语",
    "archive.badgeTanci": "弹词",
    "archive.badgeSoon": "筹备中",
    "archive.filterLabel": "档案分类",
    "archive.filterAll": "全部",
    "archive.filterYueju": "越剧",
    "archive.filterTanci": "弹词",
    "archive.filterBroadcast": "广播",
    "archive.filterNote": "越剧为当前精选；弹词可在导航「弹词」页上传图片做 OCR，也可链到姊妹项目 Talcne；广播为下一步扩展。",
    "archive.tanciTitle": "弹词 · 图片识别",
    "archive.tanciMeta": "站内 OCR · 调用 Talcne 后端",
    "archive.broadcastTitle": "广播 · 日常吴语",
    "archive.broadcastMeta": "广播 / 日常吴语 · 下一步",
    "plan.title": "项目计划",
    "plan.lead": "越语侦听：面向越语变体的语言识别——以越剧舞台方言（韵白 / 散白）为切入，不限于单一剧目。",
    "plan.nav.scope": "范围",
    "plan.nav.resources": "资源",
    "plan.nav.model": "模型",
    "plan.nav.phonology": "音韵",
    "about.title": "关于",
    "about.lead": "开发者、网站介绍、隐私与版权。",
    "about.nav.developer": "开发者",
    "about.nav.intro": "网站介绍",
    "about.nav.privacy": "隐私",
    "about.nav.copyright": "版权",
    "about.dev.title": "1. 开发者",
    "about.intro.title": "2. 网站介绍",
    "about.privacy.title": "3. 隐私",
    "about.copyright.title": "4. 版权与权利",
    "viewer.back": "← 档案",
    "viewer.story": "剧情简介",
    "viewer.thisClip": "本段",
    "viewer.search": "搜索 简 / 繁 / EN…",
    "lang.zhHans": "简体",
    "lang.zhHant": "繁體",
    "lang.en": "EN",
    "speak.status.translating": "正在翻译…（稍等几秒）",
    "speak.status.done": "完成。当前为基线识别——越语 / 舞台方言准确度会随档案语料训练而提升。",
    "speak.status.translateFail": "翻译失败：{msg}",
    "speak.status.whisperLoad": "正在加载设备端 Whisper（首次约下载 75MB 小模型）…",
    "speak.status.whisperProgress": "正在下载 Whisper 模型… {pct}%",
    "speak.status.whisperReady": "Whisper 已就绪。请选择音频文件进行识别。",
    "speak.status.recognizing": "正在用设备端 Whisper 识别「{name}」…",
    "speak.status.noSpeech": "未检测到语音。请换更清晰、更短的片段再试。",
    "speak.status.recogDone": "识别完成，正在翻译…",
    "speak.status.uploadFail": "上传识别失败：{msg}",
    "speak.status.listening": "正在聆听…请说话。结束后停止听写，几秒后出现翻译。",
    "speak.status.micDenied": "麦克风权限被拒绝。请允许后重试。",
    "speak.status.recogError": "识别错误：{msg}",
    "speak.status.noCapture": "已停止。未采集到语音——请靠近麦克风再试。",
    "speak.status.startFail": "无法开始识别。请稍候再试。",
    "speak.status.cleared": "已清除。可以重新开始。",
    "speak.status.noMic": "麦克风识别需要 Chrome 或 Edge。仍可上传音频使用 Whisper。",
    "speak.status.ready": "已就绪。可用麦克风或上传音频——识别后会很快出现翻译。",
};
const zhHant = {
    ...zhHans,
    "meta.title": "越語偵聽",
    "nav.home": "首頁",
    "nav.speak": "聽說翻譯",
    "nav.tanci": "彈詞",
    "nav.archive": "檔案",
    "nav.story": "故事",
    "nav.plan": "計畫",
    "nav.about": "關於",
    "nav.main": "主導航",
    "nav.lang": "介面語言",
    "brand.sub": "越語語音識別與檔案",
    "home.headline": "聽懂越語對話，用中文與英文讀懂它。",
    "home.support": "先看三步用法，再進入聽說翻譯、彈詞圖片識別或對話檔案。",
    "home.how1Title": "選一條路",
    "home.how1Body": "聽說翻譯：說話或上傳音訊；彈詞：上傳刻本圖片識別文字；檔案：聽精選戲曲並讀劇情。",
    "home.how2Title": "看三種文字",
    "home.how2Body": "識別後自動出現簡體、繁體與 English；檔案頁也可切換。",
    "home.how3Title": "點時間即跳轉",
    "home.how3Body": "在檔案裡點擊時間戳，音訊會跳到那一行並播放。",
    "home.ctaSpeak": "開始聽說翻譯",
    "home.ctaTanci": "打開彈詞識別",
    "home.ctaArchive": "打開檔案",
    "home.ctaStory": "我們如何做成",
    "tanci.title": "彈詞 · 圖片文字識別",
    "tanci.lead": "上傳彈詞刻本圖片，呼叫姊妹專案 Talcne 的 OCR 後端，校對後可匯出 JSON。",
    "tanci.note": "本頁只做圖片識別（無麥克風）。需本機或已部署的 Talcne 後端（預設 http://127.0.0.1:8000）。語音請用「聽說翻譯」。",
    "tanci.apiLabel": "Talcne 後端地址",
    "tanci.apiPlaceholder": "http://127.0.0.1:8000",
    "tanci.chooseImage": "選擇圖片",
    "tanci.recognize": "開始識別文字",
    "tanci.exportJson": "匯出 JSON（檔案橋）",
    "tanci.clear": "清除",
    "tanci.ready": "已就緒。選擇清晰刻本圖片後點擊識別。",
    "tanci.preview": "圖片預覽",
    "tanci.previewEmpty": "尚未選擇圖片",
    "tanci.result": "識別結果（可編輯）",
    "tanci.editHint": "校對後可匯出 JSON，再用本倉庫 import 腳本寫入檔案。",
    "tanci.placeholder": "OCR 文字會出現在這裡…",
    "tanci.status.selected": "已選擇 {n} 張圖片。點擊「開始識別文字」。",
    "tanci.status.progress": "識別中…",
    "tanci.status.progressMulti": "識別中…（{n}/{total}）",
    "tanci.status.done": "識別完成。可在下方校對，或匯出 JSON。",
    "tanci.status.fail": "識別失敗",
    "tanci.status.exported": "已下載 JSON。可用 scripts/import-talcne-export.mjs 匯入檔案。",
    "story.title": "故事 · 我們為何做、如何做成",
    "story.lead": "把吳語裡聽得見的話——尤其是長輩與日常的聲音——變成年輕人和外人也能跟讀的檔案。",
    "story.whyTitle": "為什麼重要",
    "story.whyBody": "吳語社區正在變薄：許多老人仍用家鄉話過日子，舞臺上的越劇、書場裡的彈詞、廣播裡的口音，卻越來越少被下一代聽懂。越語偵聽想留下可對讀的聲音樣本——不誇大搶救，只認真記錄，尤其珍視長輩與女性日常說話人的聲音。",
    "story.originTitle": "問題從哪裡來",
    "story.originBody": "方言流失之外，還有一道縫：臺上的韻白、散白與街上的口語並不相同。年輕人或外人往往能「聽熱鬧」，卻讀不出字句。我們從越劇切入，也把彈詞文字層與廣播口語放進同一張地圖，讓對話既聽得見，也讀得懂。",
    "story.s1Title": "收集與整理",
    "story.s1Body": "從本地戲曲、彈詞相關文本與廣播選段出發，建立清單與精選片段，而不是把整包音訊丟上公網。",
    "story.s2Title": "轉寫與翻譯",
    "story.s2Body": "為選段加上時間軸、說話人、簡體 / 繁體 / English，並寫清劇情簡介，讓不懂戲的人也能跟得上。",
    "story.s3Title": "真人試聽檢驗",
    "story.s3Body": "請熟悉方言或戲曲的長輩與本地說話人試聽、試說，對照識別結果是否「說得通、聽得懂」。",
    "story.s4Title": "用檔案反哺識別",
    "story.s4Body": "把校對過的語料當作訓練與評測依據，讓聽說翻譯從「普通話基線」慢慢靠近越語與吳語現場。",
    "story.note": "當前識別仍是基線演示。故事的重點是方法與動機：聽見吳語、讀懂對話、請真人檢驗，再慢慢改進——而不是假裝已經完美。",
    "speak.title": "聽說 → 識別 → 翻譯",
    "speak.lead": "使用麥克風或上傳音訊。稍候即可看到簡體中文、繁體中文與 English。",
    "speak.note": "即時麥克風使用瀏覽器語音引擎（推薦 Chrome / Edge）。上傳檔案使用裝置端 Whisper（首次會下載小模型）。越語 / 舞臺方言準確度會隨檔案語料累積而提升。",
    "speak.mic": "麥克風",
    "speak.upload": "上傳音訊",
    "speak.start": "開始聽寫",
    "speak.stop": "停止聽寫",
    "speak.micLang": "麥克風語言",
    "speak.chooseFile": "選擇音訊檔案",
    "speak.clear": "清除",
    "speak.fileHint": "支援 MP3 / WAV / M4A · 短片段示範效果更好",
    "speak.ready": "已就緒。可用麥克風或上傳音訊——識別後會很快出現翻譯。",
    "speak.recognized": "識別結果",
    "speak.editHint": "可編輯——改正後翻譯會自動重新整理。",
    "speak.placeholder": "識別到的對話會出現在這裡…",
    "archive.title": "對話檔案",
    "archive.lead": "本地語料精選檔案——每條作品含簡體 / 繁體 / English。點擊時間戳即可跳轉播放。",
    "archive.add": "新增劇目",
    "archive.badgeStarter": "精選",
    "archive.badgeMulti": "多語",
    "archive.badgeTanci": "彈詞",
    "archive.badgeSoon": "籌備中",
    "archive.filterLabel": "檔案分類",
    "archive.filterAll": "全部",
    "archive.filterYueju": "越劇",
    "archive.filterTanci": "彈詞",
    "archive.filterBroadcast": "廣播",
    "archive.filterNote": "越劇為當前精選；彈詞可在導航「彈詞」頁上傳圖片做 OCR，也可鏈到姊妹專案 Talcne；廣播為下一步擴展。",
    "archive.tanciTitle": "彈詞 · 圖片識別",
    "archive.tanciMeta": "站內 OCR · 呼叫 Talcne 後端",
    "archive.broadcastTitle": "廣播 · 日常吳語",
    "archive.broadcastMeta": "廣播 / 日常吳語 · 下一步",
    "plan.title": "專案計畫",
    "plan.lead": "越語偵聽：面向越語變體的語言識別——以越劇舞臺方言（韻白 / 散白）為切入，不限於單一劇目。",
    "plan.nav.scope": "範圍",
    "plan.nav.resources": "資源",
    "plan.nav.model": "模型",
    "plan.nav.phonology": "音韻",
    "about.title": "關於",
    "about.lead": "開發者、網站介紹、隱私與版權。",
    "about.nav.developer": "開發者",
    "about.nav.intro": "網站介紹",
    "about.nav.privacy": "隱私",
    "about.nav.copyright": "版權",
    "about.dev.title": "1. 開發者",
    "about.intro.title": "2. 網站介紹",
    "about.privacy.title": "3. 隱私",
    "about.copyright.title": "4. 版權與權利",
    "viewer.back": "← 檔案",
    "viewer.story": "劇情簡介",
    "viewer.thisClip": "本段",
    "viewer.search": "搜尋 簡 / 繁 / EN…",
    "lang.zhHans": "簡體",
    "lang.zhHant": "繁體",
    "lang.en": "EN",
    "speak.status.translating": "正在翻譯…（稍等幾秒）",
    "speak.status.done": "完成。目前為基線識別——越語 / 舞臺方言準確度會隨檔案語料訓練而提升。",
    "speak.status.translateFail": "翻譯失敗：{msg}",
    "speak.status.whisperLoad": "正在載入裝置端 Whisper（首次約下載 75MB 小模型）…",
    "speak.status.whisperProgress": "正在下載 Whisper 模型… {pct}%",
    "speak.status.whisperReady": "Whisper 已就緒。請選擇音訊檔案進行識別。",
    "speak.status.recognizing": "正在用裝置端 Whisper 識別「{name}」…",
    "speak.status.noSpeech": "未偵測到語音。請換更清晰、更短的片段再試。",
    "speak.status.recogDone": "識別完成，正在翻譯…",
    "speak.status.uploadFail": "上傳識別失敗：{msg}",
    "speak.status.listening": "正在聆聽…請說話。結束後停止聽寫，幾秒後出現翻譯。",
    "speak.status.micDenied": "麥克風權限被拒絕。請允許後重試。",
    "speak.status.recogError": "識別錯誤：{msg}",
    "speak.status.noCapture": "已停止。未採集到語音——請靠近麥克風再試。",
    "speak.status.startFail": "無法開始識別。請稍候再試。",
    "speak.status.cleared": "已清除。可以重新開始。",
    "speak.status.noMic": "麥克風識別需要 Chrome 或 Edge。仍可上傳音訊使用 Whisper。",
    "speak.status.ready": "已就緒。可用麥克風或上傳音訊——識別後會很快出現翻譯。",
};
const en = {
    "meta.title": "Yueyu Detecting",
    "nav.home": "Home",
    "nav.speak": "Speak",
    "nav.tanci": "Tanci",
    "nav.archive": "Archive",
    "nav.story": "Story",
    "nav.plan": "Plan",
    "nav.about": "About",
    "nav.main": "Main",
    "nav.lang": "Interface language",
    "brand.sub": "Yueyu speech & archive",
    "home.headline": "Hear Yueyu speech. Read it in Chinese and English.",
    "home.support": "Start with three steps, then open Speak, Tanci image OCR, or the Archive.",
    "home.how1Title": "Choose a path",
    "home.how1Body": "Speak: talk or upload audio. Tanci: upload woodblock images for OCR. Archive: listen to curated opera clips with plot context.",
    "home.how2Title": "Read three languages",
    "home.how2Body": "After recognition, see Simplified, Traditional, and English. Archive pages switch too.",
    "home.how3Title": "Click time to jump",
    "home.how3Body": "In the Archive, click a timestamp to jump the audio to that line and play.",
    "home.ctaSpeak": "Speak & translate",
    "home.ctaTanci": "Open tanci OCR",
    "home.ctaArchive": "Open archive",
    "home.ctaStory": "How we build it",
    "tanci.title": "Tanci · image OCR",
    "tanci.lead": "Upload tanci woodblock images, run OCR through the sister Talcne backend, proofread, then export JSON.",
    "tanci.note": "Image-only on this page (no microphone). Needs a local or deployed Talcne backend (default http://127.0.0.1:8000). For speech, use Speak.",
    "tanci.apiLabel": "Talcne API base",
    "tanci.apiPlaceholder": "http://127.0.0.1:8000",
    "tanci.chooseImage": "Choose images",
    "tanci.recognize": "Recognize text",
    "tanci.exportJson": "Export JSON (archive bridge)",
    "tanci.clear": "Clear",
    "tanci.ready": "Ready. Choose a clear woodblock image, then recognize.",
    "tanci.preview": "Image preview",
    "tanci.previewEmpty": "No image selected",
    "tanci.result": "Result (editable)",
    "tanci.editHint": "After proofreading, export JSON and import with this repo’s script.",
    "tanci.placeholder": "OCR text will appear here…",
    "tanci.status.selected": "Selected {n} image(s). Click Recognize text.",
    "tanci.status.progress": "Recognizing…",
    "tanci.status.progressMulti": "Recognizing… ({n}/{total})",
    "tanci.status.done": "Done. Proofread below, or export JSON.",
    "tanci.status.fail": "Recognition failed",
    "tanci.status.exported": "JSON downloaded. Import with scripts/import-talcne-export.mjs.",
    "story.title": "Story · Why it matters, how we build it",
    "story.lead": "Turn hearable Wu speech—especially elders and everyday voices—into an archive younger people and outsiders can follow in writing.",
    "story.whyTitle": "Why this matters",
    "story.whyBody": "Wu speech communities are thinning: many elders still live in the home tongue, while Yue opera on stage, tanci in the storytelling house, and accents on the radio are less and less understood by the next generation. Yueyu Detecting aims to keep readable sound samples—without grand claims of rescue, with careful documentation, and with special care for elders and women’s everyday voices.",
    "story.originTitle": "Where the question comes from",
    "story.originBody": "Beside dialect loss sits another gap: stage diction is not street speech. Younger listeners or outsiders can enjoy the spectacle yet miss the words. We start with Yue opera, and map tanci text layers and radio speech onto the same archive so dialogue can be both heard and read.",
    "story.s1Title": "Collect & organize",
    "story.s1Body": "Start from local opera, tanci-related text, and radio selections. Inventory and curate clips — do not dump full packs onto the public web.",
    "story.s2Title": "Transcribe & translate",
    "story.s2Body": "Add timelines, speakers, and Simplified / Traditional / English, with short plot intros so newcomers can follow.",
    "story.s3Title": "Test with real speakers",
    "story.s3Body": "Invite elders and local speakers familiar with dialect or opera to listen and speak, and check whether recognition still makes sense.",
    "story.s4Title": "Feed the archive back",
    "story.s4Body": "Use corrected corpus for training and evaluation, moving Speak from a Mandarin baseline toward living Yueyu and Wu speech.",
    "story.note": "Recognition is still a baseline demo. The story is motive and method: hear Wu, read the lines, check with people, then improve — not a claim of perfection.",
    "speak.title": "Speak → Recognize → Translate",
    "speak.lead": "Use the microphone or upload audio. After a short pause, see Simplified Chinese, Traditional Chinese, and English.",
    "speak.note": "Live mic uses the browser speech engine (Chrome/Edge). Uploads use on-device Whisper (first run downloads a small model). Yueyu / stage-dialect accuracy improves as the archive corpus grows.",
    "speak.mic": "Microphone",
    "speak.upload": "Upload audio",
    "speak.start": "Start listening",
    "speak.stop": "Stop listening",
    "speak.micLang": "Mic language",
    "speak.chooseFile": "Choose audio file",
    "speak.clear": "Clear",
    "speak.fileHint": "MP3 / WAV / M4A · short clips work best",
    "speak.ready": "Ready. Use the mic or upload audio — translation appears shortly after recognition.",
    "speak.recognized": "Recognized speech",
    "speak.editHint": "Editable — fix errors, then translation refreshes automatically.",
    "speak.placeholder": "Your recognized dialogue will appear here…",
    "speak.outHans": "Simplified Chinese",
    "speak.outHant": "Traditional Chinese",
    "speak.outEn": "English",
    "archive.title": "Dialogue Archive",
    "archive.lead": "Curated pieces from the local corpus — each with Simplified / Traditional / English. Click any timestamp to jump and play.",
    "archive.add": "Add performance",
    "archive.badgeStarter": "Starter",
    "archive.badgeMulti": "Multilingual",
    "archive.badgeTanci": "Tanci",
    "archive.badgeSoon": "Soon",
    "archive.filterLabel": "Archive categories",
    "archive.filterAll": "All",
    "archive.filterYueju": "Yue opera",
    "archive.filterTanci": "Tanci",
    "archive.filterBroadcast": "Radio",
    "archive.filterNote": "Yue opera is the live starter set; tanci OCR lives in the Tanci nav panel (Talcne backend). Radio is next.",
    "archive.tanciTitle": "Tanci · image OCR",
    "archive.tanciMeta": "In-site OCR · Talcne backend",
    "archive.broadcastTitle": "Radio · everyday Wu",
    "archive.broadcastMeta": "Radio / everyday Wu speech · coming next",
    "plan.title": "Project Plan",
    "plan.lead": "Yueyu Detecting: linguistic recognition for Yueyu varieties — starting with Yue opera stage dialect (韵白 / 散白), not limited to one repertoire.",
    "plan.nav.scope": "Scope",
    "plan.nav.resources": "Resources",
    "plan.nav.model": "Model",
    "plan.nav.phonology": "Phonology",
    "about.title": "About",
    "about.lead": "Developer, how to use this site, privacy, and copyright.",
    "about.nav.developer": "Developer",
    "about.nav.intro": "About the site",
    "about.nav.privacy": "Privacy",
    "about.nav.copyright": "Copyright",
    "about.dev.title": "1. Developer",
    "about.intro.title": "2. About this site",
    "about.privacy.title": "3. Privacy",
    "about.copyright.title": "4. Copyright & rights",
    "viewer.back": "← Archive",
    "viewer.story": "Story · Plot",
    "viewer.thisClip": "This clip",
    "viewer.search": "Search zh / en…",
    "lang.zhHans": "简体",
    "lang.zhHant": "繁體",
    "lang.en": "EN",
    "speak.status.translating": "Translating… (a few seconds)",
    "speak.status.done": "Done. Baseline recognition — Yueyu / stage-dialect accuracy improves as your archive corpus trains later models.",
    "speak.status.translateFail": "Translation failed: {msg}",
    "speak.status.whisperLoad": "Loading on-device Whisper (first run downloads a small model, ~75MB)…",
    "speak.status.whisperProgress": "Downloading Whisper model… {pct}%",
    "speak.status.whisperReady": "Whisper ready. Choose an audio file to recognize.",
    "speak.status.recognizing": "Recognizing “{name}” with on-device Whisper…",
    "speak.status.noSpeech": "No speech detected in that file. Try a clearer, shorter clip.",
    "speak.status.recogDone": "Recognition complete. Translating…",
    "speak.status.uploadFail": "Upload recognition failed: {msg}",
    "speak.status.listening": "Listening… speak now. Stop when finished; translation follows in a few seconds.",
    "speak.status.micDenied": "Microphone permission denied. Allow mic access and try again.",
    "speak.status.recogError": "Recognition error: {msg}",
    "speak.status.noCapture": "Stopped. No speech captured — try again closer to the mic.",
    "speak.status.startFail": "Could not start recognition. Wait a moment and try again.",
    "speak.status.cleared": "Cleared. Ready when you are.",
    "speak.status.noMic": "Mic recognition needs Chrome or Edge. You can still upload audio for Whisper ASR.",
    "speak.status.ready": "Ready. Use the mic or upload audio — translation appears shortly after recognition.",
};
export function tf(key, vars = {}) {
    let out = t(key);
    for (const [k, v] of Object.entries(vars)) {
        out = out.replaceAll(`{${k}}`, String(v));
    }
    return out;
}
const TABLES = {
    "zh-Hans": zhHans,
    "zh-Hant": zhHant,
    en,
};
let current = "zh-Hans";
const listeners = new Set();
export function getLocale() {
    return current;
}
export function t(key) {
    return TABLES[current][key] ?? TABLES.en[key] ?? key;
}
export function onLocaleChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
function isSiteLocale(value) {
    return value === "zh-Hans" || value === "zh-Hant" || value === "en";
}
export function detectInitialLocale() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (isSiteLocale(saved))
            return saved;
    }
    catch {
        /* ignore */
    }
    const nav = navigator.language.toLowerCase();
    if (nav.startsWith("zh-tw") || nav.startsWith("zh-hk") || nav.includes("hant"))
        return "zh-Hant";
    if (nav.startsWith("zh"))
        return "zh-Hans";
    return "en";
}
export function applyLocale(locale) {
    current = locale;
    try {
        localStorage.setItem(STORAGE_KEY, locale);
    }
    catch {
        /* ignore */
    }
    document.documentElement.lang = locale === "en" ? "en" : locale;
    document.title = t("meta.title");
    document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.dataset.i18n;
        if (!key)
            return;
        const value = t(key);
        if (el.dataset.i18nAttr) {
            el.setAttribute(el.dataset.i18nAttr, value);
            return;
        }
        if (el.dataset.i18nHtml === "true") {
            el.innerHTML = value;
            return;
        }
        el.textContent = value;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
        const key = el.dataset.i18nPlaceholder;
        if (!key || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement))
            return;
        el.placeholder = t(key);
    });
    document.querySelectorAll("[data-visible-lang]").forEach((el) => {
        const allowed = (el.dataset.visibleLang ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        const show = allowed.includes(locale);
        el.hidden = !show;
        el.setAttribute("aria-hidden", show ? "false" : "true");
    });
    document.querySelectorAll("[data-locale-option]").forEach((el) => {
        const active = el.dataset.localeOption === locale;
        el.setAttribute("aria-pressed", active ? "true" : "false");
    });
    listeners.forEach((fn) => fn(locale));
}
export function setLocale(locale) {
    applyLocale(locale);
}
export function initI18n() {
    applyLocale(detectInitialLocale());
    document.querySelectorAll("[data-locale-option]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const locale = btn.dataset.localeOption;
            if (isSiteLocale(locale))
                setLocale(locale);
        });
    });
}
//# sourceMappingURL=i18n.js.map