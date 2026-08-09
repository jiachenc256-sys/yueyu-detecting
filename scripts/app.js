function initNavigation() {
  const navButtons = document.querySelectorAll("[data-panel-target]");
  const panels = document.querySelectorAll("[data-panel]");

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.panelTarget;

      navButtons.forEach((b) => {
        b.setAttribute("aria-current", b === btn ? "page" : "false");
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
        l.setAttribute("aria-current", l === link ? "true" : "false");
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
