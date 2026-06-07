# ملاحظات التكامل مع تطبيق `al-quran`

هذه الطبعة ينبغي أن تعامل كطبعة مصورة، لا كعارض نصي مولد.

## مواصفة الطبعة المقترحة

القيم النهائية تتغير بعد رفع المستودع أو الحزم:

```dart
PageTypeSpec(
  id: 'warsh_muthamma',
  title: 'مصحف ورش المثمن',
  description: 'طبعة مصورة لرواية ورش، كل ثمن في صفحة غالبا.',
  contentType: PageContentType.image,
  isDefault: false,
  riwaya: Riwaya.warsh,
  imageVersion: 1,
  imagesBaseUrl: 'https://raw.githubusercontent.com/OWNER/REPO/main/pages/png/',
  imagesZipBaseUrl: 'https://github.com/OWNER/REPO/releases/download/v1/',
  patchBaseUrl: '',
  ayahInfoBaseUrl: 'https://raw.githubusercontent.com/OWNER/REPO/main/databases/ayahinfo/',
  databasesBaseUrl: 'https://android.quran.com/data/databases/',
  audioDatabasesBaseUrl: 'https://android.quran.com/data/warsh/databases/audio/',
  storageDirectoryName: 'warsh_muthamma',
  audioDirectoryName: 'audio',
  databaseDirectoryName: 'databases',
  ayahInfoDirectoryName: 'databases/ayahinfo/warsh_muthamma',
)
```

## نقطة يجب تعديلها في التطبيق

التطبيق الحالي يتعامل مع الطبعات المصورة غالبا على أساس 604 صفحة. هذه الطبعة عدد صفحاتها 485، لذلك يلزم دعم `pageCount` خاص بكل طبعة، أو معالجة خاصة لـ `warsh_muthamma` في مستودع الصفحات والانتقال.

## أسماء الملفات

لأقل تعديل ممكن في التطبيق، ينبغي أن تكون الصور النهائية:

```text
page001.png
page002.png
...
page485.png
```

وحزمة الصور:

```text
warsh_muthamma_pages_png.zip
```

إذا قررنا استعمال WebP بدل PNG فسيكون ذلك أفضل للحجم غالبا، لكنه يتطلب تعديل كود عرض الصفحات والتنزيل لأن النمط الحالي يبحث عن ملفات `.png`.

## بيانات الآيات

عدم وجود `ayahinfo.db` لا يمنع العرض. لكنه يمنع:

- تحديد الآية بدقة عند الضغط على الصورة.
- التظليل الدقيق.
- بعض إجراءات الآية المرتبطة بالإحداثيات.

يمكن البدء بعرض الطبعة ثم إضافة بيانات الآيات تدريجيا لاحقا.
