from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image


def build_canvas_version(
    input_path: Path,
    output_path: Path,
    left: int,
    top: int,
    right: int,
    bottom: int,
) -> dict[str, object]:
    with Image.open(input_path) as image:
        image = image.convert("RGB")
        original_width, original_height = image.size

        crop_box = (
            left,
            top,
            original_width - right,
            original_height - bottom,
        )
        cropped = image.crop(crop_box)

        canvas = Image.new("RGB", (original_width, original_height), (255, 255, 255))
        paste_x = (original_width - cropped.width) // 2
        paste_y = (original_height - cropped.height) // 2
        canvas.paste(cropped, (paste_x, paste_y))
        canvas.save(output_path, optimize=True)

    return {
        "page": input_path.stem,
        "source": str(input_path),
        "output": str(output_path),
        "originalSize": [original_width, original_height],
        "cropBox": list(crop_box),
        "croppedSize": [cropped.width, cropped.height],
        "canvasPaste": [paste_x, paste_y],
        "bytes": output_path.stat().st_size,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Apply the approved standard crop to Warsh muthamma pages while preserving original dimensions."
    )
    parser.add_argument("--input-dir", default="pages/png")
    parser.add_argument("--output-dir", default="pages/png_cropped_canvas")
    parser.add_argument("--start-page", type=int, default=3)
    parser.add_argument("--end-page", type=int, default=485)
    parser.add_argument("--left", type=int, default=43)
    parser.add_argument("--top", type=int, default=50)
    parser.add_argument("--right", type=int, default=43)
    parser.add_argument("--bottom", type=int, default=40)
    parser.add_argument(
        "--copy-untouched",
        nargs="*",
        type=int,
        default=[1, 2],
        help="Pages to copy as-is into the output directory.",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    input_dir = (repo_root / args.input_dir).resolve()
    output_dir = (repo_root / args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    report: list[dict[str, object]] = []

    for page_number in args.copy_untouched:
        input_path = input_dir / f"page{page_number:03d}.png"
        output_path = output_dir / input_path.name
        shutil.copy2(input_path, output_path)
        report.append(
            {
                "page": input_path.stem,
                "mode": "copied_untouched",
                "source": str(input_path),
                "output": str(output_path),
                "bytes": output_path.stat().st_size,
            }
        )
        print(f"copied {input_path.name}")

    for page_number in range(args.start_page, args.end_page + 1):
        input_path = input_dir / f"page{page_number:03d}.png"
        output_path = output_dir / input_path.name
        entry = build_canvas_version(
            input_path=input_path,
            output_path=output_path,
            left=args.left,
            top=args.top,
            right=args.right,
            bottom=args.bottom,
        )
        entry["mode"] = "cropped_canvas"
        report.append(entry)
        if page_number == args.start_page or page_number % 25 == 0 or page_number == args.end_page:
            print(f"processed {page_number}/{args.end_page}")

    report_path = output_dir / "crop_report.json"
    report_path.write_text(
        json.dumps(
            {
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "preset": {
                    "left": args.left,
                    "top": args.top,
                    "right": args.right,
                    "bottom": args.bottom,
                },
                "startPage": args.start_page,
                "endPage": args.end_page,
                "copiedUntouched": args.copy_untouched,
                "entries": report,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"wrote {report_path}")


if __name__ == "__main__":
    main()
