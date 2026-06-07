from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create cautious crop experiments for Warsh muthamma sample pages."
    )
    parser.add_argument("--input", required=True, help="Input PNG path.")
    parser.add_argument("--output-dir", required=True, help="Output directory.")
    parser.add_argument("--left", type=int, default=22)
    parser.add_argument("--top", type=int, default=36)
    parser.add_argument("--right", type=int, default=22)
    parser.add_argument("--bottom", type=int, default=18)
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    with Image.open(input_path) as image:
        image = image.convert("RGB")
        original_width, original_height = image.size

        crop_box = (
            args.left,
            args.top,
            original_width - args.right,
            original_height - args.bottom,
        )
        cropped = image.crop(crop_box)

        stem = input_path.stem
        cropped_name = (
            f"{stem}-crop-l{args.left}-t{args.top}-r{args.right}-b{args.bottom}.png"
        )
        cropped_path = output_dir / cropped_name
        cropped.save(cropped_path, optimize=True)

        canvas = Image.new("RGB", (original_width, original_height), (255, 255, 255))
        paste_x = (original_width - cropped.width) // 2
        paste_y = (original_height - cropped.height) // 2
        canvas.paste(cropped, (paste_x, paste_y))

        canvas_name = (
            f"{stem}-crop-canvas-l{args.left}-t{args.top}-r{args.right}-b{args.bottom}.png"
        )
        canvas_path = output_dir / canvas_name
        canvas.save(canvas_path, optimize=True)

        variant_suffix = (
            f"l{args.left}-t{args.top}-r{args.right}-b{args.bottom}"
        )
        notes_path = output_dir / f"{stem}-crop-notes-{variant_suffix}.txt"
        notes_path.write_text(
            "\n".join(
                [
                    f"input={input_path.name}",
                    f"original_size={original_width}x{original_height}",
                    f"crop_box={crop_box}",
                    f"cropped_size={cropped.width}x{cropped.height}",
                    f"canvas_size={original_width}x{original_height}",
                    f"canvas_paste={paste_x},{paste_y}",
                    f"cropped_file={cropped_name}",
                    f"canvas_file={canvas_name}",
                ]
            )
            + "\n",
            encoding="utf-8",
        )

        print(f"wrote {cropped_path}")
        print(f"wrote {canvas_path}")
        print(f"wrote {notes_path}")


if __name__ == "__main__":
    main()
