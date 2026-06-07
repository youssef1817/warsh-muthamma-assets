# ملاحظات التكامل مع تطبيق `al-quran`

هذه الطبعة ينبغي أن تعامل كطبعة مصورة مستقلة، لا كبديل لطبعة ورش الحالية.

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
  imagesBaseUrl: 'https://raw.githubusercontent.com/youssef1817/warsh-muthamma-assets/main/pages/',
  imagesZipBaseUrl: 'https://github.com/youssef1817/warsh-muthamma-assets/releases/download/v1/',
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

## أسماء الملفات

الصور النهائية داخل المستودع:

```text
pages/warsh_muthamma_png/page001.png
pages/warsh_muthamma_png/page002.png
...
pages/warsh_muthamma_png/page485.png
```

وحزمة الصور:

```text
warsh_muthamma_pages_png.zip
```

## ملاحظة دمج مهمة

التطبيق الحالي يفترض 604 صفحة في مواضع عديدة، بينما هذه الطبعة 485 صفحة فقط. لذلك سنحتاج لاحقا إلى دعم `pageCount` خاص بهذه الطبعة عند إضافتها.

## بيانات الآيات

عدم وجود `ayahinfo.db` لا يمنع العرض. لكنه يمنع:

- تحديد الآية بدقة عند الضغط على الصورة.
- التظليل الدقيق.
- بعض إجراءات الآية المرتبطة بالإحداثيات.

يمكن البدء بعرض الطبعة ثم إضافة بيانات الآيات تدريجيا لاحقا.
