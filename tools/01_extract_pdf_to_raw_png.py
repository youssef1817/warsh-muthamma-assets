from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import fitz


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def render_pdf_pages(
    pdf_path: Path,
    output_dir: Path,
    dpi: int,
    force: bool,
) -> list[dict[str, object]]:
    output_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    matrix = fitz.Matrix(dpi / 72, dpi / 72)
    pages: list[dict[str, object]] = []

    for index in range(doc.page_count):
        page_number = index + 1
        out_path = output_dir / f"page{page_number:03d}.png"

        if force or not out_path.exists():
            page = doc.load_page(index)
            pixmap = page.get_pixmap(matrix=matrix, alpha=False)
            pixmap.save(out_path)
            width = pixmap.width
            height = pixmap.height
        else:
            page = doc.load_page(index)
            width = round(page.rect.width * dpi / 72)
            height = round(page.rect.height * dpi / 72)

        pages.append(
            {
                "page": page_number,
                "file": str(out_path),
                "bytes": out_path.stat().st_size,
                "width": width,
                "height": height,
                "sha256": sha256_file(out_path),
            }
        )

        if page_number == 1 or page_number % 25 == 0 or page_number == doc.page_count:
            print(f"rendered {page_number}/{doc.page_count}")

    return pages


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Step 1: extract the Warsh muthamma PDF into raw PNG pages."
    )
    parser.add_argument("--pdf", default="source/warsh-muthamma-source.pdf")
    parser.add_argument("--out", default="pages/raw_png_from_pdf")
    parser.add_argument("--index", default="pages/raw_png_from_pdf_index.json")
    parser.add_argument("--dpi", type=int, default=300)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    pdf_path = (repo_root / args.pdf).resolve()
    output_dir = (repo_root / args.out).resolve()
    index_path = (repo_root / args.index).resolve()

    if not pdf_path.exists():
        raise FileNotFoundError(pdf_path)

    pages = render_pdf_pages(
        pdf_path=pdf_path,
        output_dir=output_dir,
        dpi=args.dpi,
        force=args.force,
    )

    total_bytes = sum(int(page["bytes"]) for page in pages)
    index = {
        "stage": "raw_png_from_pdf",
        "format": "png",
        "dpi": args.dpi,
        "pageCount": len(pages),
        "totalBytes": total_bytes,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "pages": pages,
    }
    index_path.write_text(
        json.dumps(index, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {index_path}")
    print(f"total bytes: {total_bytes}")


if __name__ == "__main__":
    main()
