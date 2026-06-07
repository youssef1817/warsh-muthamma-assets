# أدوات التحضير

هذه السكربتات تمثل خط العمل الكامل من ملف الـ PDF إلى الحزمة النهائية:

1. `01_extract_pdf_to_raw_png.py`
2. `02_crop_raw_pages.py`
3. `03_reduce_png_size.py`
4. `04_create_pages_zip.py`

الترتيب المقترح للتشغيل:

```text
py -3 tools/01_extract_pdf_to_raw_png.py
py -3 tools/02_crop_raw_pages.py
py -3 tools/03_reduce_png_size.py
py -3 tools/04_create_pages_zip.py
```

المجلدات الناتجة افتراضيا:

- `pages/raw_png_from_pdf`
- `pages/cropped_canvas_png`
- `pages/warsh_muthamma_png`
- `zips/warsh_muthamma_pages_png.zip`
