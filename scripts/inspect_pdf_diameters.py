from __future__ import annotations

from pathlib import Path
import re

from pypdf import PdfReader


def extract_first_pages_text(path: Path, pages: int = 5) -> str:
    reader = PdfReader(str(path))
    pages_to_read = min(pages, len(reader.pages))
    parts: list[str] = []
    for i in range(pages_to_read):
        parts.append(reader.pages[i].extract_text() or "")
    return "\n".join(parts)


def main() -> None:
    pdfs = [
        Path("frontend/banglore data/666e5f32-26af-4014-be6a-236d93e55d28.pdf"),
        Path("frontend/banglore data/df537184-aec2-4fe6-9214-41b1ea2ae00b.pdf"),
    ]

    pattern = re.compile(r"\b\d{2,4}\s*(?:mm|MM)\b")

    for p in pdfs:
        if not p.exists():
            print("missing", p)
            continue

        text = extract_first_pages_text(p, pages=5)
        hits = pattern.findall(text)
        print("\nPDF", p.name)
        print("pages", len(PdfReader(str(p)).pages))
        print("mm_hits", len(hits))
        print("sample_hits", hits[:30])
        snippet = re.sub(r"\s+", " ", text)[:600]
        print("snippet:", snippet)


if __name__ == "__main__":
    main()
