import { getLocale, onLocaleChange } from "./i18n.js";
function pick(item, field) {
    const locale = getLocale();
    if (locale === "en")
        return item[field].en;
    return item[field].zh;
}
async function loadFaq() {
    const res = await fetch("data/faq.json");
    if (!res.ok)
        throw new Error(`FAQ HTTP ${res.status}`);
    const doc = (await res.json());
    return doc.items ?? [];
}
function render(items) {
    const root = document.getElementById("faq-list");
    if (!root)
        return;
    root.innerHTML = "";
    for (const item of items) {
        const details = document.createElement("details");
        details.className = "faq-item";
        const summary = document.createElement("summary");
        summary.textContent = pick(item, "q");
        const body = document.createElement("div");
        body.className = "faq-item__body";
        body.textContent = pick(item, "a");
        details.append(summary, body);
        root.append(details);
    }
}
document.addEventListener("DOMContentLoaded", () => {
    let items = [];
    void loadFaq()
        .then((data) => {
        items = data;
        render(items);
    })
        .catch((error) => {
        const root = document.getElementById("faq-list");
        if (root)
            root.textContent = error instanceof Error ? error.message : String(error);
    });
    onLocaleChange(() => {
        if (items.length)
            render(items);
    });
});
//# sourceMappingURL=faq.js.map