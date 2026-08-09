import { initI18n } from "./i18n.js";

function initNavigation(): void {
  const triggers = document.querySelectorAll<HTMLElement>("[data-panel-target]");
  const navButtons = document.querySelectorAll<HTMLElement>(".site-nav [data-panel-target]");
  const panels = document.querySelectorAll<HTMLElement>("[data-panel]");

  function showPanel(target: string | undefined, trigger?: HTMLElement): void {
    if (!target) return;

    navButtons.forEach((b) => {
      if (b.dataset.panelTarget === target) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
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
      if (!target) return;
      if (el instanceof HTMLAnchorElement) event.preventDefault();
      showPanel(target, el);
    });
  });
}

function initSideNavigation(linkAttr: string, sectionAttr: string): void {
  const links = document.querySelectorAll<HTMLButtonElement>(`[${linkAttr}]`);
  const sections = document.querySelectorAll<HTMLElement>(`[${sectionAttr}]`);

  links.forEach((link) => {
    link.addEventListener("click", () => {
      const target = link.getAttribute(linkAttr);

      links.forEach((l) => {
        if (l === link) l.setAttribute("aria-current", "true");
        else l.removeAttribute("aria-current");
      });

      sections.forEach((section) => {
        section.setAttribute(
          "aria-hidden",
          section.getAttribute(sectionAttr) === target ? "false" : "true",
        );
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
    document.querySelector<HTMLElement>(`.site-nav [data-panel-target="${hash}"]`)?.click();
  }
});
