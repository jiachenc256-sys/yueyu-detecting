function initNavigation(): void {
  const navButtons = document.querySelectorAll<HTMLButtonElement>("[data-panel-target]");
  const panels = document.querySelectorAll<HTMLElement>("[data-panel]");

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.panelTarget;

      navButtons.forEach((b) => {
        if (b === btn) b.setAttribute("aria-current", "page");
        else b.removeAttribute("aria-current");
      });

      panels.forEach((panel) => {
        panel.setAttribute("aria-hidden", panel.dataset.panel === target ? "false" : "true");
      });
    });
  });
}

function initPlanNavigation(): void {
  const planLinks = document.querySelectorAll<HTMLButtonElement>("[data-plan-target]");
  const planSections = document.querySelectorAll<HTMLElement>("[data-plan-section]");

  planLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const target = link.dataset.planTarget;

      planLinks.forEach((l) => {
        if (l === link) l.setAttribute("aria-current", "true");
        else l.removeAttribute("aria-current");
      });

      planSections.forEach((section) => {
        section.setAttribute(
          "aria-hidden",
          section.dataset.planSection === target ? "false" : "true",
        );
      });
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initPlanNavigation();

  // Deep-link: index.html#speak | #archive | #plan | #dataset
  const hash = window.location.hash.replace(/^#/, "");
  if (hash) {
    const btn = document.querySelector<HTMLButtonElement>(`[data-panel-target="${hash}"]`);
    btn?.click();
  }
});
