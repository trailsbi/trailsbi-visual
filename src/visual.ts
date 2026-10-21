/*
 * TrailsBI visual: shows the TrailsBI report (lineage, model, reports, health,
 * AI readiness) inside a Power BI report.
 *
 * The analysis is not done here. `trailsbi` writes it into the semantic model as a
 * small table of text chunks (Part, Chunk); this visual joins the chunks back into the
 * page data and runs the same page script the HTML report uses (src/generated/page.ts).
 */
"use strict";

import powerbi from "powerbi-visuals-api";
import "./../style/visual.less";

import { PAGE_BODY, PAGE_CSS, PAGE_ICONS, TRAILSBI_VERSION, runPage } from "./generated/page";

import DataView = powerbi.DataView;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;

type Listener = { target: EventTarget; type: string; fn: EventListenerOrEventListenerObject; opts?: boolean | AddEventListenerOptions };
type PageApi = { open(view: string): void; current(): string };

/** The report's pages, in rail order: format-pane property, page view id, name. */
export const PAGES = [
    { prop: "lineage", view: "graph", name: "Lineage" },
    { prop: "model", view: "model", name: "Model" },
    { prop: "reports", view: "report", name: "Reports" },
    { prop: "health", view: "health", name: "Health" },
    { prop: "ai", view: "ai", name: "AI Readiness" },
];

/** Which pages are switched on in Format visual > Pages. All are on unless turned off. */
export function readPages(dataView: DataView | undefined): Set<string> {
    const saved = dataView?.metadata?.objects?.["pages"] || {};
    return new Set(PAGES.filter(p => saved[p.prop] !== false).map(p => p.view));
}

/** Joins the Part/Chunk rows into the page data, in Part order. */
export function joinChunks(dataView: DataView | undefined): { json: string } | { problem: string } {
    const table = dataView?.table;
    if (!table || !table.rows || !table.columns.length) {
        return { problem: "Add the TrailsBI table's Part and Chunk columns to this visual." };
    }
    const partCol = table.columns.findIndex(c => c.roles?.["part"]);
    const chunkCol = table.columns.findIndex(c => c.roles?.["chunk"]);
    if (partCol < 0 || chunkCol < 0) {
        return { problem: "This visual needs both fields: Part and Chunk." };
    }
    const rows = table.rows
        .map(r => ({ part: Number(r[partCol]), chunk: r[chunkCol] == null ? "" : String(r[chunkCol]) }))
        .sort((a, b) => a.part - b.part);
    for (let i = 0; i < rows.length; i++) {
        if (rows[i].part !== i + 1) {
            return { problem: `Chunk ${i + 1} of the TrailsBI data is missing. Set Part and Chunk to "Don't summarize" and remove any filters on this visual.` };
        }
    }
    return { json: rows.map(r => r.chunk).join("") };
}

function escapeHtml(text: string): string {
    return text.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

export class Visual implements IVisual {
    private readonly host: IVisualHost;
    private readonly root: HTMLElement;
    private listeners: Listener[] = [];
    private ownBodyNodes = new Set<Node>();
    private shownKey = "";
    private pages = new Set(PAGES.map(p => p.view));
    private pageApi: PageApi | null = null;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.root = options.element;
        this.root.classList.add("trailsbi-root");

        const style = document.createElement("style");
        style.textContent = PAGE_CSS;
        document.head.appendChild(style);

        // Links in the page open through Power BI, which asks the user first.
        this.root.addEventListener("click", (e: MouseEvent) => {
            const a = (e.target as Element)?.closest?.("a[href]") as HTMLAnchorElement | null;
            if (!a || a.hasAttribute("download")) return;
            const href = a.getAttribute("href") || "";
            if (/^https?:\/\//i.test(href)) {
                e.preventDefault();
                this.host.launchUrl(href);
            }
        }, true);
    }

    public update(options: VisualUpdateOptions): void {
        const events = this.host.eventService;
        events.renderingStarted(options);
        try {
            const dataView = options.dataViews?.[0];
            this.pages = readPages(dataView);
            const joined = joinChunks(dataView);
            if ("problem" in joined) {
                this.showMessage(joined.problem);
            } else if (!this.pages.size) {
                this.showMessage("All pages are hidden. Turn at least one back on in Format visual > Pages.");
            } else {
                const key = joined.json.length + ":" + hash(joined.json);
                if (key !== this.shownKey) {
                    this.mount(joined.json);
                    this.shownKey = key;
                } else {
                    window.dispatchEvent(new Event("resize"));   // the page lays itself out again
                }
                this.applyPages();
            }
            events.renderingFinished(options);
        } catch (err) {
            this.showMessage("TrailsBI could not read its data: " + String((err as Error)?.message || err));
            events.renderingFailed(options, String(err));
        }
    }

    /** Format visual > Pages: a switch for each page of the report. */
    public getFormattingModel(): powerbi.visuals.FormattingModel {
        const slices: powerbi.visuals.FormattingSlice[] = PAGES.map(p => ({
            uid: "pages_" + p.prop,
            displayName: p.name,
            control: {
                type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                properties: {
                    descriptor: { objectName: "pages", propertyName: p.prop },
                    value: this.pages.has(p.view),
                },
            },
        }));
        return {
            cards: [{
                uid: "pages_card",
                displayName: "Pages",
                description: "Choose which pages of the TrailsBI report this visual shows.",
                groups: [{ uid: "pages_group", displayName: "Show pages", slices }],
                revertToDefaultDescriptors: PAGES.map(p => ({ objectName: "pages", propertyName: p.prop })),
            }],
        };
    }

    /** Hides the rail buttons of switched-off pages, and leaves a page that was just switched off. */
    private applyPages(): void {
        if (!this.pageApi) return;
        let visible = 0;
        this.root.querySelectorAll<HTMLElement>(".rail button[data-tab]").forEach(b => {
            const on = this.pages.has(b.dataset.tab || "");
            b.hidden = !on;
            if (on) visible++;
        });
        // With a single page there is nothing to switch to, so the rail goes too.
        const rail = this.root.querySelector<HTMLElement>(".rail");
        if (rail) rail.hidden = visible < 2;
        if (!this.pages.has(this.pageApi.current())) {
            const first = PAGES.find(p => this.pages.has(p.view));
            if (first) this.pageApi.open(first.view);
        }
    }

    /** A link inside the page led to a page that is switched off. */
    private blocked(view: string, toast: (msg: string) => void): void {
        const page = PAGES.find(p => p.view === view);
        toast(`The ${page ? page.name : view} page is turned off for this visual (Format visual > Pages).`);
    }

    public destroy(): void {
        this.teardown();
    }

    /** Puts the TrailsBI page into the visual and starts its script. */
    private mount(json: string): void {
        const data = JSON.parse(json);
        const title = escapeHtml(String(data?.meta?.name || "TrailsBI"));
        this.teardown();
        // PAGE_BODY is the TrailsBI page's own markup, from the trailsbi package at build time;
        // only the escaped project name is put into it.
        const markup = PAGE_BODY.split("__TITLE__").join(title).split("__BOOT__").join("");
        const parsed = new DOMParser().parseFromString(markup, "text/html");
        this.root.append(...Array.from(parsed.body.childNodes).map(n => document.importNode(n, true)));
        this.root.appendChild(jsonScript("icons", PAGE_ICONS));
        this.root.appendChild(jsonScript("data", json));

        // The page attaches some listeners to document and window. Record them, so a later
        // refresh with new data can take them away before the page starts again.
        const record = (target: EventTarget) => {
            const original = target.addEventListener;
            target.addEventListener = (type: string, fn: EventListenerOrEventListenerObject, opts?: boolean | AddEventListenerOptions) => {
                this.listeners.push({ target, type, fn, opts });
                original.call(target, type, fn, opts);
            };
            return () => { target.addEventListener = original; };
        };
        // Nodes the page adds straight to <body> (its toast, for one) are removed on rebuild too.
        this.ownBodyNodes = new Set(Array.from(document.body.childNodes));
        const restoreDoc = record(document);
        const restoreWin = record(window);
        try {
            this.pageApi = runPage({
                download: (name: string, blob: Blob, toast: (msg: string) => void) => this.download(name, blob, toast),
                canOpen: (view: string) => this.pages.has(view),
                blocked: (view: string, toast: (msg: string) => void) => this.blocked(view, toast),
            });
        } finally {
            restoreDoc();
            restoreWin();
        }
    }

    private teardown(): void {
        for (const l of this.listeners) l.target.removeEventListener(l.type, l.fn, l.opts);
        this.listeners = [];
        this.pageApi = null;
        if (this.ownBodyNodes.size) {
            for (const n of Array.from(document.body.childNodes)) {
                if (!this.ownBodyNodes.has(n) && n !== this.root) n.parentNode?.removeChild(n);
            }
        }
        this.root.textContent = "";
        this.shownKey = "";
    }

    /** Diagram export. Power BI only lets visuals save a few file types (not PNG or SVG). */
    private download(name: string, blob: Blob, toast: (msg: string) => void): void {
        void name;
        void blob;
        toast("Diagram export is not available inside Power BI yet. Use the TrailsBI HTML report to export it.");
    }

    private showMessage(text: string): void {
        this.teardown();
        const box = document.createElement("div");
        box.className = "trailsbi-message";
        const strong = document.createElement("strong");
        strong.textContent = "TrailsBI " + TRAILSBI_VERSION;
        const p = document.createElement("p");
        p.textContent = text;
        box.append(strong, p);
        this.root.appendChild(box);
    }
}

function jsonScript(id: string, json: string): HTMLScriptElement {
    const s = document.createElement("script");
    s.type = "application/json";
    s.id = id;
    s.textContent = json;
    return s;
}

/** Small, fast string hash (FNV-1a) to tell one data set from another. */
function hash(text: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16);
}
