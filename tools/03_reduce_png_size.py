from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import shutil
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image


DEFAULT_WORKERS = 6
DEFAULT_START_PAGE = 1
DEFAULT_END_PAGE = 485


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def quantize_indexed_128(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    return rgb.quantize(
        colors=128,
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.FLOYDSTEINBERG,
    )


def process_batch(batch_index: int, page_numbers: list[int], input_dir: str, output_dir: str) -> dict[str, object]:
    input_root = Path(input_dir)
    output_root = Path(output_dir)
    batch_entries: list[dict[str, object]] = []

    for page_number in page_numbers:
        input_path = input_root / f"page{page_number:03d}.png"
        if not input_path.exists():
            raise FileNotFoundError(input_path)

        output_path = output_root / input_path.name
        with Image.open(input_path) as image:
            original_bytes = input_path.stat().st_size
            original_size = list(image.size)
            result = quantize_indexed_128(image)
            result.save(output_path, optimize=True)
            output_bytes = output_path.stat().st_size

        delta_bytes = output_bytes - original_bytes
        delta_percent = round(delta_bytes * 100.0 / original_bytes, 2)
        batch_entries.append(
            {
                "page": input_path.name,
                "originalBytes": original_bytes,
                "outputBytes": output_bytes,
                "deltaBytes": delta_bytes,
                "deltaPercent": delta_percent,
                "size": original_size,
            }
        )

    total_original = sum(int(entry["originalBytes"]) for entry in batch_entries)
    total_output = sum(int(entry["outputBytes"]) for entry in batch_entries)
    return {
        "batchIndex": batch_index,
        "pages": page_numbers,
        "entries": batch_entries,
        "totals": {
            "originalBytes": total_original,
            "outputBytes": total_output,
            "deltaBytes": total_output - total_original,
            "deltaPercent": round((total_output - total_original) * 100.0 / total_original, 2),
            "count": len(batch_entries),
        },
    }


def split_into_batches(page_numbers: list[int], workers: int) -> list[list[int]]:
    if workers < 1:
        raise ValueError("workers must be at least 1")
    if not page_numbers:
        return []
    batch_size = math.ceil(len(page_numbers) / workers)
    return [page_numbers[i : i + batch_size] for i in range(0, len(page_numbers), batch_size)]


def build_index(output_dir: Path, index_path: Path, page_numbers: list[int]) -> dict[str, object]:
    pages: list[dict[str, object]] = []
    for page_number in page_numbers:
        file_path = output_dir / f"page{page_number:03d}.png"
        with Image.open(file_path) as image:
            width, height = image.size
        pages.append(
            {
                "page": page_number,
                "file": str(file_path),
                "bytes": file_path.stat().st_size,
                "width": width,
                "height": height,
                "sha256": sha256_file(file_path),
            }
        )
    total_bytes = sum(int(page["bytes"]) for page in pages)
    index = {
        "stage": "warsh_muthamma_png",
        "format": "png",
        "pageCount": len(pages),
        "totalBytes": total_bytes,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "pages": pages,
    }
    index_path.write_text(
        json.dumps(index, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return index


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Step 3: reduce PNG size with indexed-color 128 and produce the final page set."
    )
    parser.add_argument("--input-dir", default="pages/cropped_canvas_png")
    parser.add_argument("--output-dir", default="pages/warsh_muthamma_png")
    parser.add_argument("--index", default="pages/warsh_muthamma_png_index.json")
    parser.add_argument("--start-page", type=int, default=DEFAULT_START_PAGE)
    parser.add_argument("--end-page", type=int, default=DEFAULT_END_PAGE)
    parser.add_argument("--workers", type=int, default=DEFAULT_WORKERS)
    parser.add_argument("--clean-output", action="store_true", default=True)
    parser.add_argument("--keep-output", action="store_false", dest="clean_output")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    input_dir = (repo_root / args.input_dir).resolve()
    output_dir = (repo_root / args.output_dir).resolve()
    index_path = (repo_root / args.index).resolve()

    if not input_dir.exists():
        raise FileNotFoundError(input_dir)

    if args.clean_output and output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    page_numbers = [
        int(path.stem.replace("page", ""))
        for path in sorted(input_dir.glob("page*.png"))
        if args.start_page <= int(path.stem.replace("page", "")) <= args.end_page
    ]
    if not page_numbers:
        raise FileNotFoundError(f"No page PNG files found in {input_dir}")

    batches = split_into_batches(page_numbers, args.workers)
    report_batches: list[dict[str, object]] = []
    futures = []

    print(f"input: {input_dir}")
    print(f"output: {output_dir}")
    print(f"pages: {len(page_numbers)}")
    print(f"workers: {args.workers}")

    with ProcessPoolExecutor(max_workers=args.workers) as executor:
        for batch_index, batch_pages in enumerate(batches, start=1):
            futures.append(
                executor.submit(
                    process_batch,
                    batch_index,
                    batch_pages,
                    str(input_dir),
                    str(output_dir),
                )
            )

        for future in as_completed(futures):
            batch_report = future.result()
            report_batches.append(batch_report)
            totals = batch_report["totals"]
            first_page = batch_report["pages"][0]
            last_page = batch_report["pages"][-1]
            print(
                f"batch {batch_report['batchIndex']}: page{first_page:03d}-page{last_page:03d} "
                f"{totals['originalBytes']} -> {totals['outputBytes']} ({totals['deltaPercent']}%)"
            )

    report_batches.sort(key=lambda item: int(item["batchIndex"]))
    entries = [entry for batch in report_batches for entry in batch["entries"]]
    total_original = sum(int(entry["originalBytes"]) for entry in entries)
    total_output = sum(int(entry["outputBytes"]) for entry in entries)

    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "profile": "indexed_128_no_enhancement",
        "sourceDir": str(input_dir),
        "outputDir": str(output_dir),
        "workers": args.workers,
        "batches": report_batches,
        "entries": entries,
        "totals": {
            "originalBytes": total_original,
            "outputBytes": total_output,
            "deltaBytes": total_output - total_original,
            "deltaPercent": round((total_output - total_original) * 100.0 / total_original, 2),
            "count": len(entries),
        },
    }

    report_path = output_dir / "indexed_128_report.json"
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {report_path}")

    index = build_index(output_dir=output_dir, index_path=index_path, page_numbers=page_numbers)
    print(f"wrote {index_path}")
    print(index["totalBytes"])


if __name__ == "__main__":
    if os.name == "nt":
        import multiprocessing

        multiprocessing.freeze_support()
    main()
