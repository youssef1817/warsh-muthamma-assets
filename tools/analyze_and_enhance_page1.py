from __future__ import annotations

import json
from collections import Counter
from colorsys import rgb_to_hsv
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter


@dataclass(frozen=True)
class VariantSpec:
    name: str
    contrast: float = 1.0
    color: float = 1.0
    brightness: float = 1.0
    unsharp_radius: float = 0.0
    unsharp_percent: int = 0
    unsharp_threshold: int = 0
    quantize_colors: int | None = None
    dither: bool = True


def apply_variant(image: Image.Image, spec: VariantSpec) -> Image.Image:
    result = image.convert("RGB")
    if spec.brightness != 1.0:
        result = ImageEnhance.Brightness(result).enhance(spec.brightness)
    if spec.contrast != 1.0:
        result = ImageEnhance.Contrast(result).enhance(spec.contrast)
    if spec.color != 1.0:
        result = ImageEnhance.Color(result).enhance(spec.color)
    if spec.unsharp_percent > 0:
        result = result.filter(
            ImageFilter.UnsharpMask(
                radius=spec.unsharp_radius,
                percent=spec.unsharp_percent,
                threshold=spec.unsharp_threshold,
            )
        )
    if spec.quantize_colors:
        dither_mode = Image.Dither.FLOYDSTEINBERG if spec.dither else Image.Dither.NONE
        result = result.quantize(
            colors=spec.quantize_colors,
            method=Image.Quantize.MEDIANCUT,
            dither=dither_mode,
        )
    return result


def describe_palette(image: Image.Image, topn: int = 12) -> list[dict[str, object]]:
    reduced = image.convert("RGB").quantize(colors=topn, method=Image.Quantize.MEDIANCUT)
    palette = reduced.getpalette()
    counts: Counter[int] = Counter()
    reduced_pixels = reduced.load()
    for y in range(reduced.height):
        for x in range(reduced.width):
            counts[reduced_pixels[x, y]] += 1
    total = reduced.size[0] * reduced.size[1]
    rows: list[dict[str, object]] = []
    for index, count in counts.most_common(topn):
        base = index * 3
        rgb = tuple(palette[base : base + 3])
        rows.append(
            {
                "rgb": list(rgb),
                "hex": "#{:02X}{:02X}{:02X}".format(*rgb),
                "pixels": count,
                "percent": round(count * 100.0 / total, 2),
            }
        )
    return rows


def hsv_summary(image: Image.Image) -> dict[str, float]:
    small = image.convert("RGB").resize((256, 256))
    rgb_pixels = small.load()
    hsv = [
        rgb_to_hsv(
            rgb_pixels[x, y][0] / 255.0,
            rgb_pixels[x, y][1] / 255.0,
            rgb_pixels[x, y][2] / 255.0,
        )
        for y in range(small.height)
        for x in range(small.width)
    ]
    avg_h = sum(h for h, _, _ in hsv) / len(hsv)
    avg_s = sum(s for _, s, _ in hsv) / len(hsv)
    avg_v = sum(v for _, _, v in hsv) / len(hsv)
    return {
        "avgHue01": round(avg_h, 4),
        "avgSaturation01": round(avg_s, 4),
        "avgValue01": round(avg_v, 4),
    }


def save_variant(image: Image.Image, path: Path) -> int:
    if image.mode == "P":
        image.save(path, optimize=True)
    else:
        image.save(path, optimize=True)
    return path.stat().st_size


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    source = repo_root / "tests" / "image-optimization" / "originals" / "page001.png"
    output_dir = repo_root / "tests" / "image-optimization" / "page001-visual"
    variants_dir = output_dir / "variants"
    report_dir = output_dir / "reports"
    variants_dir.mkdir(parents=True, exist_ok=True)
    report_dir.mkdir(parents=True, exist_ok=True)

    original = Image.open(source).convert("RGB")
    original_copy = output_dir / "page001-original.png"
    original.save(original_copy, optimize=True)

    specs = [
        VariantSpec(
            name="balanced_rgb",
            contrast=1.05,
            color=1.06,
            brightness=1.005,
            unsharp_radius=1.1,
            unsharp_percent=75,
            unsharp_threshold=2,
        ),
        VariantSpec(
            name="crisp_rgb",
            contrast=1.08,
            color=1.04,
            brightness=1.0,
            unsharp_radius=1.2,
            unsharp_percent=95,
            unsharp_threshold=2,
        ),
        VariantSpec(
            name="vivid_rgb",
            contrast=1.1,
            color=1.12,
            brightness=1.005,
            unsharp_radius=1.15,
            unsharp_percent=85,
            unsharp_threshold=2,
        ),
        VariantSpec(
            name="balanced_indexed_256",
            contrast=1.05,
            color=1.06,
            brightness=1.005,
            unsharp_radius=1.1,
            unsharp_percent=75,
            unsharp_threshold=2,
            quantize_colors=256,
            dither=True,
        ),
        VariantSpec(
            name="balanced_indexed_128",
            contrast=1.05,
            color=1.06,
            brightness=1.005,
            unsharp_radius=1.1,
            unsharp_percent=75,
            unsharp_threshold=2,
            quantize_colors=128,
            dither=True,
        ),
        VariantSpec(
            name="crisp_indexed_256_nodither",
            contrast=1.08,
            color=1.04,
            brightness=1.0,
            unsharp_radius=1.2,
            unsharp_percent=95,
            unsharp_threshold=2,
            quantize_colors=256,
            dither=False,
        ),
    ]

    variants_report: list[dict[str, object]] = []
    original_bytes = source.stat().st_size
    for spec in specs:
        result = apply_variant(original, spec)
        filename = f"page001-{spec.name}.png"
        output_path = variants_dir / filename
        output_bytes = save_variant(result, output_path)
        variants_report.append(
            {
                "name": spec.name,
                "file": filename,
                "mode": result.mode,
                "bytes": output_bytes,
                "deltaBytes": output_bytes - original_bytes,
                "deltaPercent": round((output_bytes - original_bytes) * 100.0 / original_bytes, 2),
                "settings": {
                    "contrast": spec.contrast,
                    "color": spec.color,
                    "brightness": spec.brightness,
                    "unsharpRadius": spec.unsharp_radius,
                    "unsharpPercent": spec.unsharp_percent,
                    "unsharpThreshold": spec.unsharp_threshold,
                    "quantizeColors": spec.quantize_colors,
                    "dither": spec.dither,
                },
            }
        )

    report = {
        "source": str(source),
        "sourceBytes": original_bytes,
        "size": list(original.size),
        "paletteSummary": describe_palette(original, topn=12),
        "hsvSummary": hsv_summary(original),
        "notes": [
            "The page is color-dense and ornament-heavy, not text-heavy only.",
            "White background occupies a large area, but the perceived identity comes from saturated reds, blues, greens, and orange borders.",
            "Small boosts in contrast and saturation are safer than aggressive sharpening.",
            "Indexed PNG may reduce weight substantially, but it can introduce banding or dotted edges in ornaments.",
        ],
        "variants": variants_report,
    }
    report_path = report_dir / "page001-analysis.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    markdown_lines = [
        "# Page 001 Color Analysis",
        "",
        f"- Source file: `{source.name}`",
        f"- Size: `{original.size[0]}x{original.size[1]}`",
        f"- Original bytes: `{original_bytes}`",
        "",
        "## Color Reading",
        "",
        "- The dominant visual families are: white background, black linework, saturated warm reds/oranges, vivid blues, and medium greens.",
        "- The ornaments use sharp hue separation, so over-saturation can quickly look artificial.",
        "- The page tolerates mild contrast and unsharp mask better than heavy saturation pushes.",
        "",
        "## Palette Summary",
        "",
    ]
    for row in report["paletteSummary"]:
        markdown_lines.append(
            f"- `{row['hex']}`: `{row['percent']}%`"
        )
    markdown_lines.extend(
        [
            "",
            "## Variants",
            "",
        ]
    )
    for row in variants_report:
        markdown_lines.append(
            f"- `{row['name']}`: `{row['bytes']}` bytes (`{row['deltaPercent']}%` vs original)"
        )
    (report_dir / "page001-analysis.md").write_text(
        "\n".join(markdown_lines) + "\n",
        encoding="utf-8",
    )

    print(f"wrote {report_path}")
    print(f"wrote {report_dir / 'page001-analysis.md'}")
    for row in variants_report:
        print(row["file"], row["bytes"], row["deltaPercent"])


if __name__ == "__main__":
    main()
