# Changelog

All notable changes to the TrailsBI visual for Power BI.

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
