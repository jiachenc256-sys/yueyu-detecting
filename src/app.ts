import { initA11y } from "./a11y.js";
import { initI18n, onLocaleChange, t } from "./i18n.js";

declare global {
  interface Window {
    __yueyuOpenZiyinLevel?: (lv: number) => void;
  }
}

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
      target === "archive" && /^archive-(tanci|yueju|speakers|broadcast|recent)$/.test(currentHash);
    const keepDeepSubhash =
      (target === "learn" && /^learn-/.test(currentHash)) ||
      (target === "speak" && /^speak-sample-/.test(currentHash)) ||
      (target === "plan" && /^plan-/.test(currentHash));
    if (
      !keepArchiveSubhash &&
      !keepDeepSubhash &&
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

      if (linkAttr === "data-plan-target" && target) {
        history.replaceState(null, "", `#plan-${target}`);
      }
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
      const isRecent = card.dataset.archiveRecent === "1";
      const catOk =
        category === "all" ||
        (category === "recent" ? isRecent : cat === category);
      const text = card.textContent?.toLowerCase() ?? "";
      const searchOk = !q || text.includes(q);
      const show = catOk && searchOk;
      card.hidden = !show;
      card.classList.toggle("archive-card--out", !show);
      card.setAttribute("aria-hidden", show ? "false" : "true");
      if (show && !firstVisible) firstVisible = card;
    });
    if (category === "recent" && grid) {
      const ordered = Array.from(cards).sort((a, b) => {
        const ar = a.dataset.archiveRecent === "1" ? 0 : 1;
        const br = b.dataset.archiveRecent === "1" ? 0 : 1;
        return ar - br;
      });
      for (const card of ordered) grid.append(card);
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
      const nextHash =
        category === "all" ? "archive" : category === "recent" ? "archive-recent" : `archive-${category}`;
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

function showPlanSection(target: string): void {
  const link = document.querySelector<HTMLButtonElement>(
    `.plan-nav__link[data-plan-target="${target}"]`,
  );
  link?.click();
}

function openLearnFayinLevel(level: number): void {
  document.querySelector<HTMLElement>(`.site-nav [data-panel-target="learn"]`)?.click();
  history.replaceState(null, "", `#learn-fayin-l${level}`);
  const tryOpen = (attempt: number): void => {
    if (typeof window.__yueyuOpenZiyinLevel === "function") {
      window.__yueyuOpenZiyinLevel(level);
      return;
    }
    document.querySelector<HTMLButtonElement>(`.learn-nav__link[data-learn-target="fayin"]`)?.click();
    document.querySelector<HTMLButtonElement>(`[data-ziyin-level="${level}"]`)?.click();
    if (attempt < 20) window.setTimeout(() => tryOpen(attempt + 1), 50);
  };
  requestAnimationFrame(() => tryOpen(0));
}

function openSpeakSample(sampleId: string): void {
  document.querySelector<HTMLElement>(`.site-nav [data-panel-target="speak"]`)?.click();
  history.replaceState(null, "", `#speak-sample-${sampleId}`);
  requestAnimationFrame(() => {
    const btn = document.getElementById(`speak-sample-${sampleId}`) as HTMLButtonElement | null;
    btn?.click();
    btn?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function initFeedbackForm(): void {
  const form = document.getElementById("feedback-form") as HTMLFormElement | null;
  const message = document.getElementById("feedback-message") as HTMLTextAreaElement | null;
  const submit = document.getElementById("feedback-submit") as HTMLButtonElement | null;
  const categoryInput = document.getElementById("feedback-category") as HTMLInputElement | null;
  const subjectInput = document.getElementById("feedback-subject") as HTMLInputElement | null;
  const status = document.getElementById("feedback-status");
  if (!form || !message || !submit) return;

  const kindButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-feedback-kind]"));

  const syncSubmit = (): void => {
    submit.disabled = message.value.trim().length === 0;
  };

  const setKind = (kind: string): void => {
    kindButtons.forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.dataset.feedbackKind === kind ? "true" : "false");
    });
    if (categoryInput) categoryInput.value = kind;
    if (subjectInput) subjectInput.value = `Yueyu Detecting — feedback (${kind})`;
  };

  kindButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.feedbackKind;
      if (!kind) return;
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
    if (active?.dataset.feedbackKind) setKind(active.dataset.feedbackKind);
  });
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

function applyHashRoute(applyArchiveFilter: (category: string, opts?: { scroll?: boolean }) => void): void {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return;

  if (hash === "about-contact" || hash === "about-apply" || hash === "about-feedback") {
    document.querySelector<HTMLElement>(`.site-nav [data-panel-target="about"]`)?.click();
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
    const filterCat =
      catMatch?.[1] === "broadcast" ? "speakers" : (catMatch?.[1] ?? "all");
    if (catMatch) {
      history.replaceState(
        null,
        "",
        `#archive-${filterCat === "speakers" ? "speakers" : catMatch[1]}`,
      );
    }
    document.querySelector<HTMLElement>(`.site-nav [data-panel-target="archive"]`)?.click();
    applyArchiveFilter(filterCat, { scroll: true });
    return;
  }

  const planMatch = /^plan-([a-z]+)$/.exec(hash);
  if (planMatch) {
    document.querySelector<HTMLElement>(`.site-nav [data-panel-target="plan"]`)?.click();
    showPlanSection(planMatch[1]!);
    return;
  }

  const learnMatch = /^learn-fayin-l(\d+)$/.exec(hash);
  if (learnMatch) {
    openLearnFayinLevel(Number(learnMatch[1]));
    return;
  }

  const sampleMatch = /^speak-sample-([a-z0-9-]+)$/.exec(hash);
  if (sampleMatch) {
    openSpeakSample(sampleMatch[1]!);
    return;
  }

  document.querySelector<HTMLElement>(`.site-nav [data-panel-target="${hash}"]`)?.click();
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

  applyHashRoute(applyArchiveFilter);
  window.addEventListener("hashchange", () => applyHashRoute(applyArchiveFilter));
});
