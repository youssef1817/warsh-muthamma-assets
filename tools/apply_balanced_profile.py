from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter


def apply_balanced_profile(image: Image.Image, profile: str) -> Image.Image:
    result = image.convert("RGB")
    result = ImageEnhance.Brightness(result).enhance(1.005)
    result = ImageEnhance.Contrast(result).enhance(1.05)
    result = ImageEnhance.Color(result).enhance(1.06)
    result = result.filter(
        ImageFilter.UnsharpMask(radius=1.1, percent=75, threshold=2)
    )
    if profile == "balanced_indexed_256":
        result = result.quantize(
            colors=256,
            method=Image.Quantize.MEDIANCUT,
            dither=Image.Dither.FLOYDSTEINBERG,
        )
    return result


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Apply the unified balanced indexed profile to a folder of PNG pages."
    )
    parser.add_argument("--input-dir", default="pages/png_cropped_canvas")
    parser.add_argument("--output-dir", default="pages/png_cropped_canvas_balanced_rgb")
    parser.add_argument(
        "--profile",
        choices=["balanced_rgb", "balanced_indexed_256"],
        default="balanced_rgb",
    )
    parser.add_argument("--start-page", type=int, default=1)
    parser.add_argument("--end-page", type=int, default=485)
    parser.add_argument("--skip-existing", action="store_true", default=True)
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    input_dir = (repo_root / args.input_dir).resolve()
    output_dir = (repo_root / args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "profile": args.profile,
        "sourceDir": str(input_dir),
        "outputDir": str(output_dir),
        "entries": [],
    }

    input_files = [
        path
        for path in sorted(input_dir.glob("page*.png"))
        if args.start_page <= int(path.stem.replace("page", "")) <= args.end_page
    ]
    if not input_files:
        raise FileNotFoundError(f"No page PNG files found in {input_dir}")

    for index, input_path in enumerate(input_files, start=1):
        with Image.open(input_path) as image:
            original_size = input_path.stat().st_size
            original_dimensions = list(image.size)
            output_path = output_dir / input_path.name
            if args.skip_existing and output_path.exists():
                output_size = output_path.stat().st_size
                report["entries"].append(
                    {
                        "page": input_path.name,
                        "originalBytes": original_size,
                        "outputBytes": output_size,
                        "deltaBytes": output_size - original_size,
                        "deltaPercent": round((output_size - original_size) * 100.0 / original_size, 2),
                        "dimensions": original_dimensions,
                        "skipped": True,
                    }
                )
                if index == 1 or index % 25 == 0 or index == len(input_files):
                    print(f"skipped {index}/{len(input_files)}")
                continue

            result = apply_balanced_profile(image, args.profile)
            result.save(output_path, optimize=True)
            output_size = output_path.stat().st_size

        report["entries"].append(
            {
                "page": input_path.name,
                "originalBytes": original_size,
                "outputBytes": output_size,
                "deltaBytes": output_size - original_size,
                "deltaPercent": round((output_size - original_size) * 100.0 / original_size, 2),
                "dimensions": original_dimensions,
            }
        )

        if index == 1 or index % 25 == 0 or index == len(input_files):
            print(f"processed {index}/{len(input_files)}")

    total_original = sum(int(entry["originalBytes"]) for entry in report["entries"])
    total_output = sum(int(entry["outputBytes"]) for entry in report["entries"])
    report["totals"] = {
        "originalBytes": total_original,
        "outputBytes": total_output,
        "deltaBytes": total_output - total_original,
        "deltaPercent": round((total_output - total_original) * 100.0 / total_original, 2),
        "count": len(report["entries"]),
    }

    report_path = output_dir / "balanced_profile_report.json"
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {report_path}")
    print(report["totals"])


if __name__ == "__main__":
    main()
