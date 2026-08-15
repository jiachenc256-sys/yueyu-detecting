import { initA11y } from "./a11y.js";
import { initI18n, onLocaleChange, t } from "./i18n.js";

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

    const currentHash = window.location.hash.replace(/^#/, "");
    const keepArchiveSubhash =
      target === "archive" && /^archive-(tanci|yueju|speakers|broadcast)$/.test(currentHash);
    if (
      !keepArchiveSubhash &&
      (trigger instanceof HTMLAnchorElement || window.location.hash !== `#${target}`)
    ) {
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

function initSideNavigation(linkAttr: string, sectionAttr: string, linkSelector?: string): void {
  const links = document.querySelectorAll<HTMLButtonElement>(linkSelector ?? `[${linkAttr}]`);

  links.forEach((link) => {
    link.addEventListener("click", () => {
      const target = link.getAttribute(linkAttr);
      const root = link.closest(".plan-layout, .learn-layout") ?? document;
      const localLinks = root.querySelectorAll<HTMLButtonElement>(linkSelector ?? `[${linkAttr}]`);
      const sections = root.querySelectorAll<HTMLElement>(`[${sectionAttr}]`);

      localLinks.forEach((l) => {
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

function initStoryMore(): void {
  const triggers = document.querySelectorAll<HTMLElement>("[data-story-more]");
  const full = document.getElementById("story-full");
  if (!full || !triggers.length) return;

  const labelEl = () =>
    document.querySelector<HTMLElement>("[data-story-more] [data-i18n^='story.more']");

  const setOpen = (open: boolean): void => {
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
    if (label) label.textContent = t(open ? "story.moreHide" : "story.more");
  });
}

function initArchiveFilters(): (category: string, opts?: { scroll?: boolean }) => void {
  const filters = document.querySelectorAll<HTMLButtonElement>("[data-archive-filter]");
  const cards = document.querySelectorAll<HTMLElement>("[data-archive-category]");
  const grid = document.querySelector<HTMLElement>(".archive-grid");
  const searchInput = document.getElementById("archive-search") as HTMLInputElement | null;
  let activeCategory = "all";

  function apply(category: string, opts?: { scroll?: boolean; flash?: boolean }): void {
    if (!filters.length || !cards.length) return;
    activeCategory = category;
    filters.forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.dataset.archiveFilter === category ? "true" : "false");
    });
    const q = (searchInput?.value ?? "").trim().toLowerCase();
    let firstVisible: HTMLElement | null = null;
    cards.forEach((card) => {
      const cat = card.dataset.archiveCategory ?? "yueju";
      const catOk = category === "all" || cat === category;
      const text = card.textContent?.toLowerCase() ?? "";
      const searchOk = !q || text.includes(q);
      const show = catOk && searchOk;
      card.hidden = !show;
      card.classList.toggle("archive-card--out", !show);
      card.setAttribute("aria-hidden", show ? "false" : "true");
      if (show && !firstVisible) firstVisible = card;
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

  searchInput?.addEventListener("input", () => {
    apply(activeCategory);
  });

  return apply;
}

function showAboutSection(target: string): void {
  const aboutRoot = document.querySelector(".panel[data-panel='about'] .plan-layout");
  if (!aboutRoot) return;
  const links = aboutRoot.querySelectorAll<HTMLButtonElement>(".plan-nav__link[data-about-target]");
  const sections = aboutRoot.querySelectorAll<HTMLElement>("[data-about-section]");
  links.forEach((l) => {
    l.setAttribute("aria-current", l.getAttribute("data-about-target") === target ? "true" : "false");
  });
  sections.forEach((section) => {
    section.setAttribute(
      "aria-hidden",
      section.getAttribute("data-about-section") === target ? "false" : "true",
    );
  });
  const anchor = document.getElementById(`about-${target}`);
  requestAnimationFrame(() => {
    (anchor ?? aboutRoot).scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function openAboutSection(target: string): void {
  document.querySelector<HTMLElement>(`.site-nav [data-panel-target="about"]`)?.click();
  showAboutSection(target);
  history.replaceState(null, "", `#about-${target}`);
}

function initAboutDeepLinks(): void {
  document.querySelectorAll<HTMLAnchorElement>("[data-footer-about]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const target = link.dataset.footerAbout;
      if (!target) return;
      openAboutSection(target);
    });
  });
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
  const applyArchiveFilter = initArchiveFilters();

  const hash = window.location.hash.replace(/^#/, "");
  if (hash === "about-contact" || hash === "about-apply") {
    openAboutSection(hash === "about-contact" ? "contact" : "apply");
  } else if (hash.startsWith("archive")) {
    const catMatch = /^archive-(tanci|yueju|speakers|broadcast)$/.exec(hash);
    const filterCat = catMatch?.[1] === "broadcast" ? "speakers" : (catMatch?.[1] ?? "all");
    if (catMatch) history.replaceState(null, "", `#archive-${filterCat === "speakers" ? "speakers" : catMatch[1]}`);
    document.querySelector<HTMLElement>(`.site-nav [data-panel-target="archive"]`)?.click();
    applyArchiveFilter(filterCat, { scroll: true });
  } else if (hash) {
    document.querySelector<HTMLElement>(`.site-nav [data-panel-target="${hash}"]`)?.click();
  }
});
