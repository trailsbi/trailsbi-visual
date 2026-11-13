# Changelog

All notable changes to the TrailsBI visual for Power BI.

## 1.3.0 - 2026-11-12

- The page from trailsbi 1.5.2:
  - The visual shows one report, as before (`trailsbi --embed` works on one report at a time), so the new Workspace view and Scope menu stay hidden in it.
  - Connection strings with quoted values (`Initial Catalog="Sales Model"`) are read correctly, so a live-connected report names its published semantic model properly.
  - Smaller fixes and tidier code carried over from the page.

## 1.2.0 - 2026-11-09

- The page from trailsbi 1.4.0:
  - The new graph view: the lineage as one network, with a local mode around the selected item and
    rings from the sources in the middle to pages and visuals outside, and Obsidian's Display settings.
    Scroll to zoom, drag to move; names fade in as you zoom.
    It keeps working in a narrow visual.
  - Report measures (measures a live-connected report adds) show in the lineage apart from the
    model's measures, with a "Keep measures in the model" Health check.

## 1.1.0 - 2026-11-07

- The page from trailsbi 1.3.0
  - calculation groups as their own kind of object
  - help for DAX and Power Query functions when you point at them in code
  - a dark theme that follows the system setting, with a switch in the header
  - a compact header and rail when the visual is narrow.
- Certification groundwork:
  - The whole visual, including the generated page script, now passes the Power BI custom visual lint.

## 1.0.1 - 2026-11-04

- One field: the visual now takes only the TrailsBI table's **Chunk** column. Needs trailsbi 1.2.2 or later; for a table written by an older trailsbi, the visual says to update it and run `trailsbi --embed` again.
- Right-click anywhere in the visual opens Power BI's context menu.
- Every DAX and M code block has a copy button at its top right when the pointer is over it. Where Power BI blocks the clipboard, the button selects the code so Ctrl+C copies it.

## 1.0.0 - 2026-10-25

- First release for AppSource.
- README: `trailsbi --embed` (trailsbi 1.2 or later) adds the TrailsBI page with this visual, so there is nothing to import.

## 0.9.2 - 2026-10-23

- Sharper DAX and M code. Power BI scales the report page to fit the window, and the browser drew
  the code boxes (which scroll and have a solid background) as a separate layer that was stretched
  with it. In the Model list they now grow instead of scrolling; elsewhere their background is
  painted so that they stay part of the page.

## 0.9.1 - 2026-10-23

- When the TrailsBI table does not match itself (trailsbi 1.1.0 could cut the data next to a
  space, which Power BI trims), the visual now says to update trailsbi and run `--embed` again,
  instead of showing "Cannot read properties of undefined"
- Support link points to https://trailsbi.com/support/
- Shorter visual ID (`trailsbiE7A4C19D`). Power BI Desktop puts the ID twice in the path of the
  visual's files inside the report, and the old 46-character ID could push it past Windows' 256
  character limit ("Unable to save document ... path is too long"). Power BI sees this as a new
  visual: in a report that has 0.9.0, remove that visual, import 0.9.1 and add it again
- Use with trailsbi 1.1.2 or later, which leaves the new ID out of the analysis

## 0.9.0 - 2026-10-22

First preview.

- Shows the TrailsBI report (Lineage, Model, Reports, Health, AI Readiness) inside a Power BI
  report, from the hidden TrailsBI table that `trailsbi --embed` (trailsbi 1.1.0 or later)
  writes into the semantic model
- Format visual > Pages: switch each page on or off
- Links open through Power BI; no network calls; diagram export is not available inside
  Power BI yet
