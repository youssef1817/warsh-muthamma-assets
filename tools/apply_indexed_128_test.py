from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image


DEFAULT_SAMPLE_PAGES = [1, 3, 64, 223, 250, 412, 485]


def quantize_indexed_128(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    return rgb.quantize(
        colors=128,
        method=Image.Quantize.MEDIANCUT,
        dither=Image.Dither.FLOYDSTEINBERG,
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run a no-enhancement indexed-color-128 test on sample Warsh muthamma pages."
    )
    parser.add_argument("--input-dir", default="pages/png_cropped_canvas")
    parser.add_argument("--output-dir", default="tests/image-optimization/indexed-128-test")
    parser.add_argument("--pages", nargs="*", type=int, default=DEFAULT_SAMPLE_PAGES)
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    input_dir = (repo_root / args.input_dir).resolve()
    output_dir = (repo_root / args.output_dir).resolve()
    variants_dir = output_dir / "variants"
    output_dir.mkdir(parents=True, exist_ok=True)
    variants_dir.mkdir(parents=True, exist_ok=True)

    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "profile": "indexed_128_no_enhancement",
        "inputDir": str(input_dir),
        "pages": args.pages,
        "entries": [],
    }

    for page_number in args.pages:
        input_path = input_dir / f"page{page_number:03d}.png"
        if not input_path.exists():
            raise FileNotFoundError(input_path)

        with Image.open(input_path) as image:
            original_bytes = input_path.stat().st_size
            original_size = list(image.size)
            result = quantize_indexed_128(image)
            output_path = variants_dir / input_path.name
            result.save(output_path, optimize=True)
            output_bytes = output_path.stat().st_size

        report["entries"].append(
            {
                "page": input_path.name,
                "originalBytes": original_bytes,
                "outputBytes": output_bytes,
                "deltaBytes": output_bytes - original_bytes,
                "deltaPercent": round((output_bytes - original_bytes) * 100.0 / original_bytes, 2),
                "size": original_size,
            }
        )
        print(
            f"{input_path.name}: {original_bytes} -> {output_bytes} ({report['entries'][-1]['deltaPercent']}%)"
        )

    total_original = sum(int(entry["originalBytes"]) for entry in report["entries"])
    total_output = sum(int(entry["outputBytes"]) for entry in report["entries"])
    report["totals"] = {
        "originalBytes": total_original,
        "outputBytes": total_output,
        "deltaBytes": total_output - total_original,
        "deltaPercent": round((total_output - total_original) * 100.0 / total_original, 2),
        "count": len(report["entries"]),
    }

    report_path = output_dir / "indexed_128_report.json"
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {report_path}")
    print(report["totals"])


if __name__ == "__main__":
    main()
