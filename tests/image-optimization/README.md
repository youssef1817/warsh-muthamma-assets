# Image Optimization Test Bed

This folder is a small comparison lab before touching the full extracted set.

## Layout

- `originals/`: untouched source samples copied from `pages/png/`
- `enhanced/`: improved/compressed variants we generate later
- `reports/`: notes and comparison tables

## Sample Set

- `page001.png`: ornate opening page, highest size, dense color and border detail
- `page002.png`: early text page with decorative elements
- `page003.png`: early text page with a different source width
- `page064.png`: one of the lightest pages by file size
- `page223.png`: typical light middle-page sample
- `page250.png`: representative full text page from the middle
- `page412.png`: smallest file-size sample
- `page485.png`: final page with multiple short surahs and separators

## Rule

Files in `originals/` are reference copies and should remain untouched.
All experiments should write next to them in `enhanced/` with explicit names.

Example naming:

```text
enhanced/page250.webp
enhanced/page250-q90.webp
enhanced/page250-png-optimized.png
```
