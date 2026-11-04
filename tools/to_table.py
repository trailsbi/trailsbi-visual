"""Turn a TrailsBI HTML report into the table the TrailsBI visual reads, as CSV.

`trailsbi --embed` writes this table into the project itself. This tool is for testing: the
harness (tools/harness/run.js) takes the table as CSV.

    python tools/to_table.py "TrailsBI Report - Sales - 2026-10-08 15-20.html"

writes two files next to the report:

  TrailsBI data.csv    for the harness, or Power BI Desktop: Get data, Text/CSV
  TrailsBI.tmdl        the same table as TMDL

The table has one column, Chunk. Each value is a numbered piece of the report data,
"000001|...", "000002|...", at most 30,000 characters, cut the way trailsbi --embed cuts
it. Standard library only.
"""

from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

CHUNK = 30_000
PREFIX_DIGITS = 6
DATA_RE = re.compile(r'<script id="data" type="application/json">(.*?)</script>', re.S)


def chunks_of(html: str) -> list:
    m = DATA_RE.search(html)
    if not m:
        raise SystemExit("This is not a TrailsBI report: no page data found.")
    data, size = m.group(1), CHUNK - PREFIX_DIGITS - 1
    pieces, i, n = [], 0, len(data)
    while i < n:  # never cut next to whitespace: Power BI trims trailing spaces
        j = min(i + size, n)
        while i + 1 < j < n and (data[j - 1].isspace() or data[j].isspace()):
            j -= 1
        pieces.append(data[i:j])
        i = j
    return [f"{k:0{PREFIX_DIGITS}d}|{p}" for k, p in enumerate(pieces or [""], 1)]


def m_text(value: str) -> str:
    """A Power Query (M) text literal. In M, "#(" starts an escape such as #(lf), so a
    literal "#(" is written as "#(#)(" and comes back unchanged."""
    return '"' + value.replace('"', '""').replace("#(", "#(#)(") + '"'


def tmdl(chunks: list) -> str:
    rows = ",\n".join(f"\t\t\t\t\t\t{{{m_text(c)}}}" for c in chunks)
    return (
        "table TrailsBI\n"
        "\n"
        "\tcolumn Chunk\n"
        "\t\tdataType: string\n"
        "\t\tsummarizeBy: none\n"
        "\t\tsourceColumn: Chunk\n"
        "\n"
        "\tpartition TrailsBI = m\n"
        "\t\tmode: import\n"
        "\t\tsource =\n"
        "\t\t\t\tlet\n"
        "\t\t\t\t\tSource = #table(\n"
        "\t\t\t\t\t\ttype table [Chunk = text],\n"
        "\t\t\t\t\t\t{\n"
        f"{rows}\n"
        "\t\t\t\t\t\t}\n"
        "\t\t\t\t\t)\n"
        "\t\t\t\tin\n"
        "\t\t\t\t\tSource\n"
    )


def main(argv: list) -> int:
    if len(argv) != 1:
        print(__doc__, file=sys.stderr)
        return 2
    report = Path(argv[0])
    chunks = chunks_of(report.read_text(encoding="utf-8"))

    csv_path = report.with_name("TrailsBI data.csv")
    with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Chunk"])
        w.writerows([c] for c in chunks)

    tmdl_path = report.with_name("TrailsBI.tmdl")
    tmdl_path.write_text(tmdl(chunks), encoding="utf-8")

    total = sum(len(c) for c in chunks)
    print(f"{len(chunks)} chunks, {total:,} characters")
    print(f"Wrote {csv_path}")
    print(f"Wrote {tmdl_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
