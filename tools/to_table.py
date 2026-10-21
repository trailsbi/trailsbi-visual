"""Turn a TrailsBI HTML report into the table the TrailsBI visual reads, as CSV.

`trailsbi --embed` writes this table into the project itself. This tool is for testing: the
harness (tools/harness/run.js) takes the table as CSV.

    python tools/to_table.py "TrailsBI Report - Sales - 2026-10-08 15-20.html"

writes two files next to the report:

  TrailsBI data.csv    for the harness, or Power BI Desktop: Get data, Text/CSV
  TrailsBI.tmdl        the same table as TMDL

The table has two columns: Part (1, 2, 3 ...) and Chunk (up to 30,000 characters of the report
data each). Standard library only.
"""

from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

CHUNK = 30_000
DATA_RE = re.compile(r'<script id="data" type="application/json">(.*?)</script>', re.S)


def chunks_of(html: str) -> list:
    m = DATA_RE.search(html)
    if not m:
        raise SystemExit("This is not a TrailsBI report: no page data found.")
    data = m.group(1)
    return [data[i:i + CHUNK] for i in range(0, len(data), CHUNK)]


def m_text(value: str) -> str:
    """A Power Query (M) text literal. In M, "#(" starts an escape such as #(lf), so a
    literal "#(" is written as "#(#)(" and comes back unchanged."""
    return '"' + value.replace('"', '""').replace("#(", "#(#)(") + '"'


def tmdl(chunks: list) -> str:
    rows = ",\n".join(f"\t\t\t\t\t\t{{{i}, {m_text(c)}}}" for i, c in enumerate(chunks, 1))
    return (
        "table TrailsBI\n"
        "\n"
        "\tcolumn Part\n"
        "\t\tdataType: int64\n"
        "\t\tformatString: 0\n"
        "\t\tsummarizeBy: none\n"
        "\t\tsourceColumn: Part\n"
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
        "\t\t\t\t\t\ttype table [Part = Int64.Type, Chunk = text],\n"
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
        w.writerow(["Part", "Chunk"])
        w.writerows([i, c] for i, c in enumerate(chunks, 1))

    tmdl_path = report.with_name("TrailsBI.tmdl")
    tmdl_path.write_text(tmdl(chunks), encoding="utf-8")

    total = sum(len(c) for c in chunks)
    print(f"{len(chunks)} chunks, {total:,} characters")
    print(f"Wrote {csv_path}")
    print(f"Wrote {tmdl_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
