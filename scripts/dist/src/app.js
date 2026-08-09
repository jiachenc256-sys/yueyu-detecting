import { initI18n } from "./i18n.js";
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
        if (trigger instanceof HTMLAnchorElement || window.location.hash !== `#${target}`) {
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
    const sections = document.querySelectorAll(`[${sectionAttr}]`);
    links.forEach((link) => {
        link.addEventListener("click", () => {
            const target = link.getAttribute(linkAttr);
            links.forEach((l) => {
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
document.addEventListener("DOMContentLoaded", () => {
    initI18n();
    initNavigation();
    initSideNavigation("data-plan-target", "data-plan-section");
    initSideNavigation("data-about-target", "data-about-section");
    const hash = window.location.hash.replace(/^#/, "");
    if (hash) {
        document.querySelector(`.site-nav [data-panel-target="${hash}"]`)?.click();
    }
});
//# sourceMappingURL=app.js.map