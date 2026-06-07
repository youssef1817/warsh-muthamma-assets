# Dynamic Line Bands Detection for Warsh Muthamma

## كيف يعمل كشف الأسطر
قمنا بإنشاء سكربت `07_detect_page_line_bands.js` الذي يستخدم مكتبة `sharp` لمعالجة صور طبعة `warsh_muthamma`.
السكربت يقوم بالآتي:
1. تحويل الصورة إلى تدرج الرمادي (Grayscale).
2. إزالة الهوامش (Crop borders) للتركيز على منطقة النص (Text Region).
3. حساب الإسقاط الأفقي (Horizontal Projection Profile) لعدد بكسلات النص في كل صف.
4. إيجاد الفراغات بين الأسطر لتقسيم النص إلى حزم (Bands) أفقية.
5. دمج الحزم القريبة جداً التي تخص نفس السطر (مثل الحركات).
6. حساب قيم Normalized (بين 0 و 1) لحدود كل سطر: `top`, `bottom`, و `center`.

## أين تُحفظ Line Bands
تُحفظ البيانات أولاً كملفات JSON لكل صفحة في المجلد:
`databases/ayahinfo/warsh_muthamma/page_layout_json/`
ثم يقوم المولدات (`05` و `06`) بدمج هذه الملفات وحفظها في قاعدة بيانات SQLite `quran.ar.warsh_muthamma.db` داخل جدول جديد يسمى `page_line_bands` الذي يحتوي الأعمدة: `page`, `line`, `top`, `bottom`, `center`.

## كيف يتم Regenerate
لإعادة بناء البيانات بالكامل:
1. تشغيل استخراج الأسطر: `node 07_detect_page_line_bands.js all`
2. تشغيل إعادة توليد قاعدة البيانات الأولية: `node 05_generate_initial_ayahinfo.js`
3. أو تحديث قاعدة البيانات فقط من ملفات JSON عبر: `node 06_rebuild_ayahinfo.js`

## الصفحات ذات Manual Override
نظراً لأن الصفحتين الأولى والثانية (الفاتحة وأول البقرة) تحتويان على زخارف وتوزيع خاص للنص، تم تعيينهما للوضع `manualOverride: true`:
- **الصفحة 001**: تم تحديدها بـ 7 أسطر.
- **الصفحة 002**: تم تحديدها بـ 9 أسطر.
الأسطر في هاتين الصفحتين تم حسابها نظرياً لتتوزع بشكل متساوٍ في منطقة النص.
