# TrailsBI visual for Power BI

The [TrailsBI](https://trailsbi.com) report (lineage, model, reports, health and AI
readiness) inside a Power BI report, as a custom visual.

**Version 1.0.** Works in Power BI Desktop and the Power BI service. AppSource listing in
progress; until then `trailsbi --embed` brings it into your report (below).

## How it works

1. `trailsbi --embed` analyses the PBIP project and writes the result into its semantic model
   as a hidden table, **TrailsBI**, with two columns: `Part` (1, 2, 3 ...) and `Chunk` (up to
   30,000 characters of the analysis each, under Power BI's text limits).
2. It also adds a **TrailsBI** page to the report, hidden in view mode, with this visual on it
   and bound to the table. The visual is saved inside the report, the way Power BI Desktop
   saves a visual imported from a file.
3. The visual reads the table, joins the chunks in `Part` order and runs the same page the HTML
   report uses. Nothing is fetched: the visual makes no network calls.

The page is not kept here twice: `tools/import_page.py` copies its markup, styles and script
from the `trailsbi` package into `src/generated/page.ts`. Each trailsbi release bundles a
release of this visual.

## Install and use

You need [trailsbi](https://github.com/trailsbi/trailsbi) 1.2 or later (`pip install -U trailsbi`).

1. Close the project in Power BI Desktop, then run:
   `trailsbi "D:\Reports\Sales" --embed`
2. Open the project in Power BI Desktop, refresh (**Home > Refresh**) so the table loads, and go
   to the **TrailsBI** page.
3. Optional: **Format visual > Pages** has a switch for each page (Lineage, Model, Reports,
   Health, AI Readiness). All are on by default. A page that is off leaves the side rail, and
   links that lead to it say it is turned off. With one page left the rail is hidden.

When the model or report changes, run `trailsbi --embed` again and refresh. It keeps the
TrailsBI page as you left it and updates the visual when trailsbi ships a newer one.

**Adding the visual by hand** (a report not saved in the PBIR format, or a page of your own):
download `TrailsBI.pbiviz` from the
[latest release](https://github.com/trailsbi/trailsbi-visual/releases/latest), and in the
Visualizations pane choose **...** (Get more visuals), **Import a visual from a file**. Add it to
a page, then in the Data pane right-click, turn on **View hidden**, and drag **TrailsBI > Part**
and **TrailsBI > Chunk** onto the visual.

In the Power BI service, a visual that is not from AppSource needs the tenant setting *Allow
visuals created using the Power BI SDK*, unless your admin adds it as an organizational visual.

The TrailsBI page is hidden from report readers, but the TrailsBI table holds the model's names,
DAX and data source addresses, and anyone who can edit or build on the report can read them.
Embed it only where that is allowed.

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
