# TrailsBI visual for Power BI

The [TrailsBI](https://trailsbi.com) report (lineage, model, reports, health and AI
readiness) inside a Power BI report, as a custom visual.

**Status: preview (0.9).** Works in Power BI Desktop and the Power BI service. Not yet on
AppSource; install it from a file (below).

## How it works

1. `trailsbi --embed` analyses the PBIP project and writes the result into its semantic model
   as a hidden table, **TrailsBI**, with two columns: `Part` (1, 2, 3 ...) and `Chunk` (up to
   30,000 characters of the analysis each, under Power BI's text limits).
2. This visual reads the table, joins the chunks in `Part` order and runs the same page the
   HTML report uses. Nothing is fetched: the visual makes no network calls.

The page is not kept here twice: `tools/import_page.py` copies its markup, styles and script
from the `trailsbi` package into `src/generated/page.ts`.

## Install and use

You need [trailsbi](https://github.com/trailsbi/trailsbi) 1.1.2 or later (`pip install -U trailsbi`).

1. Download `TrailsBI.pbiviz` from the
   [latest release](https://github.com/trailsbi/trailsbi-visual/releases/latest).
2. Close the project in Power BI Desktop, then write the TrailsBI table into its model:
   `trailsbi "D:\Reports\Sales" --embed`
3. Open the project in Power BI Desktop and refresh (**Home > Refresh**) so the table loads.
4. In the Visualizations pane: **...** (Get more visuals), **Import a visual from a file**, and
   pick `TrailsBI.pbiviz`.
5. Add a page and the TrailsBI visual, and stretch it over the page. The table is hidden: in
   the Data pane, right-click and turn on **View hidden**, then drag **TrailsBI > Part** and
   **TrailsBI > Chunk** onto the visual.
6. Optional: **Format visual > Pages** has a switch for each page (Lineage, Model, Reports,
   Health, AI Readiness). All are on by default. A page that is off leaves the side rail, and
   links that lead to it say it is turned off. With one page left the rail is hidden.

When the model or report changes, run `trailsbi --embed` again and refresh.

In the Power BI service, a visual imported from a file needs the tenant setting *Allow visuals
created using the Power BI SDK*, unless your admin adds it as an organizational visual.

The TrailsBI table holds the model's names, DAX and data source addresses, so anyone who can
open the report can read them in the visual. Embed it only where that is allowed.

## Inside Power BI's sandbox

| | In the HTML report | In the visual |
| --- | --- | --- |
| Links (trailsbi.com, About) | Open in a new tab | Open through Power BI, which asks the user first |
| Remembered choices (compact/detailed, panels) | Kept in the browser | Reset each time the report opens |
| Diagram export (PNG, SVG) | Downloads the file | Not available: Power BI lets visuals save only txt, csv, json, xml, pdf and xlsx |
| Data | In the page | In the TrailsBI table, as of the last `--embed` |

## Build

```
npm ci
npm install -g powerbi-visuals-tools
python tools/import_page.py --src ../trailsbi/src   # or omit --src to use pip's trailsbi
npm run lint
pbiviz package                                       # writes dist/*.pbiviz
```

A tag `v*` builds the visual and attaches `TrailsBI.pbiviz` to a GitHub release
(`.github/workflows/release.yml`).

## Test without Power BI

`tools/harness/run.js` loads the built visual into a sandboxed iframe like Power BI's, with a
stand-in host, and checks rendering, every page, scrolling, links, export, the page switches,
refresh with new data and a missing chunk. It takes the table as CSV;
`tools/to_table.py` makes one from a TrailsBI HTML report:

```
npm install --no-save playwright
python tools/to_table.py "TrailsBI Report - Sales - 2026-10-22 10-00.html"
node tools/harness/run.js "TrailsBI data.csv" "another TrailsBI data.csv" --shots shots
```

## Support

Questions and problems: [issues](https://github.com/trailsbi/trailsbi-visual/issues) or
contact@trailsbi.com. Never attach a real customer's project or its TrailsBI table.

## Licence

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

Power BI is a trademark of Microsoft. TrailsBI is not affiliated with or endorsed by Microsoft.
