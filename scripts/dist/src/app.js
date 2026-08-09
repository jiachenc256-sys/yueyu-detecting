"use strict";
function initNavigation() {
    const navButtons = document.querySelectorAll("[data-panel-target]");
    const panels = document.querySelectorAll("[data-panel]");
    navButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const target = btn.dataset.panelTarget;
            navButtons.forEach((b) => {
                if (b === btn)
                    b.setAttribute("aria-current", "page");
                else
                    b.removeAttribute("aria-current");
            });
            panels.forEach((panel) => {
                panel.setAttribute("aria-hidden", panel.dataset.panel === target ? "false" : "true");
            });
        });
    });
}
function initPlanNavigation() {
    const planLinks = document.querySelectorAll("[data-plan-target]");
    const planSections = document.querySelectorAll("[data-plan-section]");
    planLinks.forEach((link) => {
        link.addEventListener("click", () => {
            const target = link.dataset.planTarget;
            planLinks.forEach((l) => {
                if (l === link)
                    l.setAttribute("aria-current", "true");
                else
                    l.removeAttribute("aria-current");
            });
            planSections.forEach((section) => {
                section.setAttribute("aria-hidden", section.dataset.planSection === target ? "false" : "true");
            });
        });
    });
}
document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    initPlanNavigation();
});
//# sourceMappingURL=app.js.map