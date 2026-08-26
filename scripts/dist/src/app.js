import { initA11y } from "./a11y.js";
import { initI18n, onLocaleChange, t, getLocale } from "./i18n.js?v=20260826waveab";
function initNavigation() {
    const triggers = document.querySelectorAll("[data-panel-target]");
    const navButtons = document.querySelectorAll(".site-nav [data-panel-target]");
    const panels = document.querySelectorAll("[data-panel]");
    /** Map tool panels to top-nav hubs for aria-current. */
    const navForPanel = {
        hear: "hear",
        speak: "hear",
        language: "language",
        dictionary: "language",
        learn: "language",
        plan: "language",
        faq: "language",
        memory: "memory",
        archive: "memory",
        tanci: "memory",
        home: "home",
        story: "story",
        research: "research",
        about: "about",
    };
    function showPanel(target, trigger) {
        if (!target)
            return;
        const navKey = navForPanel[target] ?? target;
        navButtons.forEach((b) => {
            if (b.dataset.panelTarget === navKey)
                b.setAttribute("aria-current", "page");
            else
                b.removeAttribute("aria-current");
        });
        panels.forEach((panel) => {
            panel.setAttribute("aria-hidden", panel.dataset.panel === target ? "false" : "true");
        });
        const currentHash = window.location.hash.replace(/^#/, "");
        const keepArchiveSubhash = target === "archive" && /^archive-(tanci|yueju|speakers|broadcast|recent)$/.test(currentHash);
        const keepDeepSubhash = (target === "learn" && /^learn-/.test(currentHash)) ||
            (target === "speak" && /^speak-sample-/.test(currentHash)) ||
            (target === "plan" && /^plan-/.test(currentHash)) ||
            (target === "dictionary" && /^dict-q-/.test(currentHash));
        if (!keepArchiveSubhash &&
            !keepDeepSubhash &&
            (trigger instanceof HTMLAnchorElement || window.location.hash !== `#${target}`)) {
            history.replaceState(null, "", `#${target}`);
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
        const sample = trigger?.dataset.speakOpenSample;
        if (target === "speak" && sample) {
            requestAnimationFrame(() => {
                const btn = document.getElementById(`speak-sample-${sample}`);
                btn?.click();
            });
        }
    }
    triggers.forEach((el) => {
        el.addEventListener("click", (event) => {
            const target = el.dataset.panelTarget;
            if (!target)
                return;
            if (el instanceof HTMLAnchorElement)
                event.preventDefault();
            showPanel(target, el);
        });
    });
}
function initSideNavigation(linkAttr, sectionAttr, linkSelector) {
    const links = document.querySelectorAll(linkSelector ?? `[${linkAttr}]`);
    links.forEach((link) => {
        link.addEventListener("click", () => {
            const target = link.getAttribute(linkAttr);
            const root = link.closest(".plan-layout, .learn-layout") ?? document;
            const localLinks = root.querySelectorAll(linkSelector ?? `[${linkAttr}]`);
            const sections = root.querySelectorAll(`[${sectionAttr}]`);
            localLinks.forEach((l) => {
                if (l === link)
                    l.setAttribute("aria-current", "true");
                else
                    l.removeAttribute("aria-current");
            });
            sections.forEach((section) => {
                section.setAttribute("aria-hidden", section.getAttribute(sectionAttr) === target ? "false" : "true");
            });
            if (linkAttr === "data-plan-target" && target) {
                history.replaceState(null, "", `#plan-${target}`);
            }
        });
    });
}
function initStoryMore() {
    const triggers = document.querySelectorAll("[data-story-more]");
    const full = document.getElementById("story-full");
    if (!full || !triggers.length)
        return;
    const labelEl = () => document.querySelector("[data-story-more] [data-i18n^='story.more']");
    const setOpen = (open) => {
        full.hidden = !open;
        full.setAttribute("aria-hidden", open ? "false" : "true");
        triggers.forEach((el) => {
            el.setAttribute("aria-expanded", open ? "true" : "false");
            el.classList.toggle("story-more--open", open);
        });
        const label = labelEl();
        if (label) {
            const key = open ? "story.moreHide" : "story.more";
            label.dataset.i18n = key;
            label.textContent = t(key);
        }
        if (open) {
            requestAnimationFrame(() => {
                full.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        }
    };
    // Closed by default — full story only after “know more”.
    setOpen(false);
    triggers.forEach((el) => {
        el.addEventListener("click", () => {
            setOpen(full.hidden);
        });
    });
    onLocaleChange(() => {
        const open = !full.hidden;
        const label = labelEl();
        if (label)
            label.textContent = t(open ? "story.moreHide" : "story.more");
    });
}
function initArchiveFilters() {
    const filters = document.querySelectorAll("[data-archive-filter]");
    const cards = document.querySelectorAll("[data-archive-category]");
    const grid = document.querySelector(".archive-grid");
    const searchInput = document.getElementById("archive-search");
    let activeCategory = "all";
    function apply(category, opts) {
        if (!filters.length || !cards.length)
            return;
        activeCategory = category;
        filters.forEach((btn) => {
            btn.setAttribute("aria-pressed", btn.dataset.archiveFilter === category ? "true" : "false");
        });
        const q = (searchInput?.value ?? "").trim().toLowerCase();
        let firstVisible = null;
        cards.forEach((card) => {
            const cat = card.dataset.archiveCategory ?? "yueju";
            const isRecent = card.dataset.archiveRecent === "1";
            const catOk = category === "all" ||
                (category === "recent" ? isRecent : cat === category);
            const text = card.textContent?.toLowerCase() ?? "";
            const searchOk = !q || text.includes(q);
            const show = catOk && searchOk;
            card.hidden = !show;
            card.classList.toggle("archive-card--out", !show);
            card.setAttribute("aria-hidden", show ? "false" : "true");
            if (show && !firstVisible)
                firstVisible = card;
        });
        if (category === "recent" && grid) {
            const ordered = Array.from(cards).sort((a, b) => {
                const ar = a.dataset.archiveRecent === "1" ? 0 : 1;
                const br = b.dataset.archiveRecent === "1" ? 0 : 1;
                return ar - br;
            });
            for (const card of ordered)
                grid.append(card);
        }
        if (opts?.scroll || opts?.flash) {
            requestAnimationFrame(() => {
                const target = firstVisible ?? grid;
                target?.scrollIntoView({ behavior: "smooth", block: "start" });
                if (opts.flash && firstVisible) {
                    firstVisible.classList.add("archive-card--flash");
                    window.setTimeout(() => firstVisible?.classList.remove("archive-card--flash"), 1200);
                }
            });
        }
    }
    filters.forEach((btn) => {
        btn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const category = btn.dataset.archiveFilter ?? "all";
            apply(category, { scroll: true, flash: category !== "all" });
            const nextHash = category === "all" ? "archive" : category === "recent" ? "archive-recent" : `archive-${category}`;
            history.replaceState(null, "", `#${nextHash}`);
        });
    });
    searchInput?.addEventListener("input", () => {
        apply(activeCategory);
    });
    return apply;
}
function showAboutSection(target) {
    const aboutRoot = document.querySelector(".panel[data-panel='about'] .plan-layout");
    if (!aboutRoot)
        return;
    const links = aboutRoot.querySelectorAll(".plan-nav__link[data-about-target]");
    const sections = aboutRoot.querySelectorAll("[data-about-section]");
    links.forEach((l) => {
        l.setAttribute("aria-current", l.getAttribute("data-about-target") === target ? "true" : "false");
    });
    sections.forEach((section) => {
        section.setAttribute("aria-hidden", section.getAttribute("data-about-section") === target ? "false" : "true");
    });
    const anchor = document.getElementById(`about-${target}`);
    requestAnimationFrame(() => {
        (anchor ?? aboutRoot).scrollIntoView({ behavior: "smooth", block: "start" });
    });
}
function openAboutSection(target) {
    const merged = target === "why" ||
        target === "solved" ||
        target === "built" ||
        target === "learned" ||
        target === "open"
        ? "behind"
        : target;
    document.querySelector(`.site-nav [data-panel-target="about"]`)?.click();
    showAboutSection(merged);
    history.replaceState(null, "", `#about-${merged}`);
}
function showPlanSection(target) {
    const link = document.querySelector(`.plan-nav__link[data-plan-target="${target}"]`);
    link?.click();
}
function openLearnFayinLevel(level) {
    activatePanel("learn");
    history.replaceState(null, "", `#learn-fayin-l${level}`);
    const tryOpen = (attempt) => {
        if (typeof window.__yueyuOpenZiyinLevel === "function") {
            window.__yueyuOpenZiyinLevel(level);
            return;
        }
        document.querySelector(`.learn-nav__link[data-learn-target="fayin"]`)?.click();
        document.querySelector(`[data-ziyin-level="${level}"]`)?.click();
        if (attempt < 20)
            window.setTimeout(() => tryOpen(attempt + 1), 50);
    };
    requestAnimationFrame(() => tryOpen(0));
}
function openLearnQuest(gate) {
    activatePanel("learn");
    history.replaceState(null, "", gate != null ? `#learn-quest-l${gate}` : "#learn-quest");
    const tryOpen = (attempt) => {
        if (typeof window.__yueyuOpenQuest === "function") {
            window.__yueyuOpenQuest(gate);
            return;
        }
        document.querySelector(`.learn-nav__link[data-learn-target="fayin"]`)?.click();
        document.querySelector(`[data-learn-mode="quest"]`)?.click();
        if (attempt < 40)
            window.setTimeout(() => tryOpen(attempt + 1), 50);
    };
    requestAnimationFrame(() => tryOpen(0));
}
function openSpeakSample(sampleId) {
    activatePanel("speak");
    history.replaceState(null, "", `#speak-sample-${sampleId}`);
    requestAnimationFrame(() => {
        const btn = document.getElementById(`speak-sample-${sampleId}`);
        btn?.click();
        btn?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
}
function activatePanel(target) {
    const navButtons = document.querySelectorAll(".site-nav [data-panel-target]");
    const panels = document.querySelectorAll("[data-panel]");
    const navForPanel = {
        hear: "hear",
        speak: "hear",
        language: "language",
        dictionary: "language",
        learn: "language",
        plan: "language",
        faq: "language",
        memory: "memory",
        archive: "memory",
        tanci: "memory",
        home: "home",
        story: "story",
        research: "research",
        about: "about",
    };
    const navKey = navForPanel[target] ?? target;
    navButtons.forEach((b) => {
        if (b.dataset.panelTarget === navKey)
            b.setAttribute("aria-current", "page");
        else
            b.removeAttribute("aria-current");
    });
    panels.forEach((panel) => {
        panel.setAttribute("aria-hidden", panel.dataset.panel === target ? "false" : "true");
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
}
window.__yueyuActivatePanel = activatePanel;
function openArchiveCategory(category, applyArchiveFilter) {
    activatePanel("archive");
    const nextHash = category === "all" ? "archive" : `archive-${category}`;
    history.replaceState(null, "", `#${nextHash}`);
    applyArchiveFilter?.(category, { scroll: true });
}
function initSurpriseMe() {
    const btn = document.getElementById("home-surprise");
    if (!btn)
        return;
    const reveal = document.getElementById("home-surprise-reveal");
    const pieceLinks = () => Array.from(document.querySelectorAll(".archive-grid a.piece-card[href]"));
    const sampleMeta = {
        liangzhu: { zh: "梁祝 · 十八相送（听说示例）", zhHant: "梁祝 · 十八相送（聽說示例）", en: "Butterfly Lovers · Speak sample" },
        xianglin: { zh: "祥林嫂 · 心酸话（听说示例）", zhHant: "祥林嫂 · 心酸話（聽說示例）", en: "Xianglin Sao · Speak sample" },
        jingchai: { zh: "荆钗记（听说示例）", zhHant: "荊釵記（聽說示例）", en: "Jingchai · Speak sample" },
    };
    const showReveal = (label, then) => {
        if (!reveal) {
            then();
            return;
        }
        reveal.hidden = false;
        reveal.innerHTML = `<p class="surprise-reveal__kicker">${t("surprise.youFound")}</p><p class="surprise-reveal__title">${label}</p>`;
        window.setTimeout(() => {
            reveal.hidden = true;
            reveal.innerHTML = "";
            then();
        }, 1100);
    };
    const localeLabel = (meta) => {
        const loc = getLocale();
        if (loc === "en")
            return meta.en;
        if (loc === "zh-Hant")
            return meta.zhHant;
        return meta.zh;
    };
    btn.addEventListener("click", () => {
        const roll = Math.floor(Math.random() * 4);
        if (roll === 0) {
            const samples = ["liangzhu", "xianglin", "jingchai"];
            const id = samples[Math.floor(Math.random() * samples.length)];
            const meta = sampleMeta[id];
            showReveal(localeLabel(meta), () => openSpeakSample(id));
            return;
        }
        if (roll === 1) {
            const links = pieceLinks();
            if (links.length) {
                const pick = links[Math.floor(Math.random() * links.length)];
                const title = pick.querySelector("h3, strong, .piece-card__title")?.textContent?.trim() ||
                    pick.getAttribute("aria-label") ||
                    pick.href.split("/").pop() ||
                    "Archive";
                showReveal(title, () => {
                    window.location.href = pick.href;
                });
                return;
            }
        }
        if (roll === 2) {
            const loc = getLocale();
            const label = loc === "en" ? "Pearl Tower · tanci page" : loc === "zh-Hant" ? "珍珠塔 · 彈詞頁" : "珍珠塔 · 弹词页";
            showReveal(label, () => {
                window.location.href = "pieces/pearl-tower-gift.html";
            });
            return;
        }
        // Dictionary: prefer chars that have archive examples.
        const seeds = ["心", "话", "还", "看", "步", "河"];
        const q = seeds[Math.floor(Math.random() * seeds.length)];
        const loc = getLocale();
        const dictLabel = loc === "en" ? `Dictionary · ${q}` : loc === "zh-Hant" ? `詞典 · ${q}` : `词典 · ${q}`;
        showReveal(dictLabel, () => {
            history.replaceState(null, "", `#dict-q-${encodeURIComponent(q)}`);
            activatePanel("dictionary");
            const tryOpen = (attempt) => {
                if (typeof window.__yueyuOpenDictionaryQuery === "function") {
                    window.__yueyuOpenDictionaryQuery(q);
                    return;
                }
                if (attempt < 40)
                    window.setTimeout(() => tryOpen(attempt + 1), 50);
            };
            requestAnimationFrame(() => tryOpen(0));
        });
    });
}
function initArchiveDeepLinks(applyArchiveFilter) {
    document.querySelectorAll("[data-archive-open]").forEach((el) => {
        el.addEventListener("click", (event) => {
            const category = el.dataset.archiveOpen;
            if (!category)
                return;
            event.preventDefault();
            openArchiveCategory(category, applyArchiveFilter);
        });
    });
}
function initFeedbackForm() {
    const form = document.getElementById("feedback-form");
    const message = document.getElementById("feedback-message");
    const submit = document.getElementById("feedback-submit");
    const categoryInput = document.getElementById("feedback-category");
    const subjectInput = document.getElementById("feedback-subject");
    const status = document.getElementById("feedback-status");
    if (!form || !message || !submit)
        return;
    const kindButtons = Array.from(document.querySelectorAll("[data-feedback-kind]"));
    const syncSubmit = () => {
        submit.disabled = message.value.trim().length === 0;
    };
    const setKind = (kind) => {
        kindButtons.forEach((btn) => {
            btn.setAttribute("aria-pressed", btn.dataset.feedbackKind === kind ? "true" : "false");
        });
        if (categoryInput)
            categoryInput.value = kind;
        if (subjectInput)
            subjectInput.value = `Yueyu Detecting — feedback (${kind})`;
    };
    kindButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const kind = btn.dataset.feedbackKind;
            if (!kind)
                return;
            setKind(kind);
        });
    });
    message.addEventListener("input", syncSubmit);
    syncSubmit();
    form.addEventListener("submit", () => {
        if (status) {
            status.hidden = false;
            status.textContent = t("feedback.sending");
        }
    });
    onLocaleChange(() => {
        const active = kindButtons.find((b) => b.getAttribute("aria-pressed") === "true");
        if (active?.dataset.feedbackKind)
            setKind(active.dataset.feedbackKind);
    });
}
function initAboutDeepLinks() {
    document.querySelectorAll("[data-footer-about]").forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            const target = link.dataset.footerAbout;
            if (!target)
                return;
            openAboutSection(target);
        });
    });
}
function applyHashRoute(applyArchiveFilter) {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash)
        return;
    if (hash === "about-contact" || hash === "about-apply" || hash === "about-feedback") {
        document.querySelector(`.site-nav [data-panel-target="about"]`)?.click();
        const section = hash === "about-feedback" ? "feedback" : "contact";
        showAboutSection(section);
        history.replaceState(null, "", `#${hash}`);
        if (hash === "about-apply" || hash === "about-feedback") {
            requestAnimationFrame(() => {
                document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        }
        return;
    }
    if (hash.startsWith("archive")) {
        const catMatch = /^archive-(tanci|yueju|speakers|broadcast|recent)$/.exec(hash);
        const filterCat = catMatch?.[1] === "broadcast" ? "speakers" : (catMatch?.[1] ?? "all");
        if (catMatch) {
            history.replaceState(null, "", `#archive-${filterCat === "speakers" ? "speakers" : catMatch[1]}`);
        }
        activatePanel("archive");
        applyArchiveFilter(filterCat, { scroll: true });
        return;
    }
    const planMatch = /^plan-([a-z]+)$/.exec(hash);
    if (planMatch) {
        activatePanel("plan");
        showPlanSection(planMatch[1]);
        return;
    }
    if (hash === "learn-ipa") {
        activatePanel("learn");
        document.querySelector(`.learn-nav__link[data-learn-target="ipa"]`)?.click();
        return;
    }
    const dictQueryMatch = /^dict-q-(.+)$/.exec(hash);
    if (dictQueryMatch) {
        let q = dictQueryMatch[1] ?? "";
        try {
            q = decodeURIComponent(q);
        }
        catch {
            /* keep raw */
        }
        activatePanel("dictionary");
        window.__yueyuOpenDictionaryQuery?.(q);
        return;
    }
    const learnMatch = /^learn-fayin-l(\d+)$/.exec(hash);
    if (learnMatch) {
        openLearnFayinLevel(Number(learnMatch[1]));
        return;
    }
    if (hash === "learn-quest") {
        openLearnQuest();
        return;
    }
    const questMatch = /^learn-quest-l(\d+)$/.exec(hash);
    if (questMatch) {
        openLearnQuest(Number(questMatch[1]));
        return;
    }
    const sampleMatch = /^speak-sample-([a-z0-9-]+)$/.exec(hash);
    if (sampleMatch) {
        openSpeakSample(sampleMatch[1]);
        return;
    }
    const navBtn = document.querySelector(`.site-nav [data-panel-target="${hash}"]`);
    if (navBtn)
        navBtn.click();
    else
        activatePanel(hash);
}
document.addEventListener("DOMContentLoaded", () => {
    initA11y();
    initI18n();
    initNavigation();
    initStoryMore();
    initSideNavigation("data-plan-target", "data-plan-section", ".plan-nav__link[data-plan-target]");
    initSideNavigation("data-about-target", "data-about-section", ".plan-nav__link[data-about-target]");
    initSideNavigation("data-learn-target", "data-learn-section", ".learn-nav__link[data-learn-target]");
    initAboutDeepLinks();
    initFeedbackForm();
    const applyArchiveFilter = initArchiveFilters();
    initSurpriseMe();
    initArchiveDeepLinks(applyArchiveFilter);
    applyHashRoute(applyArchiveFilter);
    window.addEventListener("hashchange", () => applyHashRoute(applyArchiveFilter));
});
//# sourceMappingURL=app.js.map