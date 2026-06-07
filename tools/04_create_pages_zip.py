from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def create_zip(input_dir: Path, output_zip: Path) -> dict[str, object]:
    if output_zip.exists():
        output_zip.unlink()
    output_zip.parent.mkdir(parents=True, exist_ok=True)

    files = sorted(input_dir.glob("page*.png"))
    if not files:
        raise FileNotFoundError(f"No page PNG files found in {input_dir}")

    with ZipFile(output_zip, mode="w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for file_path in files:
            archive_name = f"{input_dir.name}/{file_path.name}"
            archive.write(file_path, arcname=archive_name)

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "inputDir": str(input_dir),
        "zipFile": str(output_zip),
        "entryRoot": input_dir.name,
        "pageCount": len(files),
        "zipBytes": output_zip.stat().st_size,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Step 4: create the final ZIP archive for the optimized Warsh muthamma pages."
    )
    parser.add_argument("--input-dir", default="pages/warsh_muthamma_png")
    parser.add_argument("--output-zip", default="zips/warsh_muthamma_pages_png.zip")
    parser.add_argument("--report", default="zips/warsh_muthamma_pages_png_report.json")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    input_dir = (repo_root / args.input_dir).resolve()
    output_zip = (repo_root / args.output_zip).resolve()
    report_path = (repo_root / args.report).resolve()

    report = create_zip(input_dir=input_dir, output_zip=output_zip)
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {output_zip}")
    print(f"wrote {report_path}")
    print(report["zipBytes"])


if __name__ == "__main__":
    main()
