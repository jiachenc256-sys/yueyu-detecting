import { initA11y } from "./a11y.js";
import { initI18n, onLocaleChange, t } from "./i18n.js?v=20260810t";
function initNavigation() {
    const triggers = document.querySelectorAll("[data-panel-target]");
    const navButtons = document.querySelectorAll(".site-nav [data-panel-target]");
    const panels = document.querySelectorAll("[data-panel]");
    function showPanel(target, trigger) {
        if (!target)
            return;
        navButtons.forEach((b) => {
            if (b.dataset.panelTarget === target)
                b.setAttribute("aria-current", "page");
            else
                b.removeAttribute("aria-current");
        });
        panels.forEach((panel) => {
            panel.setAttribute("aria-hidden", panel.dataset.panel === target ? "false" : "true");
        });
        const currentHash = window.location.hash.replace(/^#/, "");
        const keepArchiveSubhash = target === "archive" && /^archive-(tanci|yueju|broadcast)$/.test(currentHash);
        if (!keepArchiveSubhash &&
            (trigger instanceof HTMLAnchorElement || window.location.hash !== `#${target}`)) {
            history.replaceState(null, "", `#${target}`);
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
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
function initSideNavigation(linkAttr, sectionAttr) {
    const links = document.querySelectorAll(`[${linkAttr}]`);
    links.forEach((link) => {
        link.addEventListener("click", () => {
            const target = link.getAttribute(linkAttr);
            const root = link.closest(".plan-layout, .learn-layout") ?? document;
            const localLinks = root.querySelectorAll(`[${linkAttr}]`);
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
    function apply(category, opts) {
        if (!filters.length || !cards.length)
            return;
        filters.forEach((btn) => {
            btn.setAttribute("aria-pressed", btn.dataset.archiveFilter === category ? "true" : "false");
        });
        let firstVisible = null;
        cards.forEach((card) => {
            const cat = card.dataset.archiveCategory ?? "yueju";
            const show = category === "all" || cat === category;
            card.hidden = !show;
            card.classList.toggle("archive-card--out", !show);
            card.setAttribute("aria-hidden", show ? "false" : "true");
            if (show && !firstVisible)
                firstVisible = card;
        });
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
            const nextHash = category === "all" ? "archive" : `archive-${category}`;
            history.replaceState(null, "", `#${nextHash}`);
        });
    });
    return apply;
}
document.addEventListener("DOMContentLoaded", () => {
    initA11y();
    initI18n();
    initNavigation();
    initStoryMore();
    initSideNavigation("data-plan-target", "data-plan-section");
    initSideNavigation("data-about-target", "data-about-section");
    initSideNavigation("data-learn-target", "data-learn-section");
    const applyArchiveFilter = initArchiveFilters();
    const hash = window.location.hash.replace(/^#/, "");
    if (hash.startsWith("archive")) {
        const catMatch = /^archive-(tanci|yueju|broadcast)$/.exec(hash);
        if (catMatch)
            history.replaceState(null, "", `#archive-${catMatch[1]}`);
        document.querySelector(`.site-nav [data-panel-target="archive"]`)?.click();
        applyArchiveFilter(catMatch?.[1] ?? "all", { scroll: true });
    }
    else if (hash) {
        document.querySelector(`.site-nav [data-panel-target="${hash}"]`)?.click();
    }
});
//# sourceMappingURL=app.js.map