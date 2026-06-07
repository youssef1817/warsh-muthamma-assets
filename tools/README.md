# أدوات التحضير

هذه السكربتات تمثل خط العمل المعتمد حاليا، من ملف الـ PDF إلى الصفحات النهائية ثم بيانات تحديد الآيات الأولية.

## خط إنتاج الصور

1. `01_extract_pdf_to_raw_png.py`
2. `02_crop_raw_pages.py`
3. `03_reduce_png_size.py`

الترتيب المقترح:

```text
py -3 tools/01_extract_pdf_to_raw_png.py
py -3 tools/02_crop_raw_pages.py
py -3 tools/03_reduce_png_size.py
```

المخرجات الأساسية:

- `pages/raw_png_from_pdf`
- `pages/cropped_canvas_png`
- `pages/warsh_muthamma_png`

مهم: الصفحات النهائية تنشر كما هي داخل `pages/warsh_muthamma_png/`، ولا يوجد في المسار الإنتاجي الحالي أي أرشيف ZIP خاص بالصفحات.

## خط إنتاج ayahinfo

4. `05_generate_initial_ayahinfo.js`
5. `06_rebuild_ayahinfo.js`

الاستعمال المعتاد:

```text
node tools/05_generate_initial_ayahinfo.js
node tools/06_rebuild_ayahinfo.js
```

وهذا ينتج:

- `databases/ayahinfo/warsh_muthamma/pages_json/`
- `databases/ayahinfo/warsh_muthamma/quran.ar.warsh_muthamma.db`
- `databases/ayahinfo/warsh_muthamma/ayahinfo_muthamma.zip`
