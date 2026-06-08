# ملاحظات التكامل مع تطبيق `al-quran`

هذه الطبعة تُعامل كطبعة مصورة مستقلة.

## المواصفة المقترحة

```dart
PageTypeSpec(
  id: 'warsh_muthamma',
  title: 'ورش مثمن',
  description: 'طبعة ورش مثمنة مصورة ومقسمة إلى أثمان.',
  contentType: PageContentType.image,
  isDefault: false,
  riwaya: Riwaya.warsh,
  imageVersion: 1,
  totalPages: 485,
  imagesBaseUrl: 'https://raw.githubusercontent.com/youssef1817/warsh-muthamma-assets/main/pages/warsh_muthamma_png/',
  imagesZipBaseUrl: '',
  patchBaseUrl: '',
  ayahInfoBaseUrl: 'https://raw.githubusercontent.com/youssef1817/warsh-muthamma-assets/main/databases/ayahinfo/warsh_muthamma/',
  databasesBaseUrl: 'https://android.quran.com/data/databases/',
  audioDatabasesBaseUrl: 'https://android.quran.com/data/warsh/databases/audio/',
  storageDirectoryName: 'warsh_muthamma',
  audioDirectoryName: 'audio',
  databaseDirectoryName: 'databases',
  ayahInfoDirectoryName: 'databases/ayahinfo/warsh_muthamma',
)
```

## آلية تنزيل الصفحات

هذه الطبعة لا تعتمد على أرشيف ZIP للصفحات. المسار الصحيح هو:

```text
https://raw.githubusercontent.com/youssef1817/warsh-muthamma-assets/main/pages/warsh_muthamma_png/page001.png
...
https://raw.githubusercontent.com/youssef1817/warsh-muthamma-assets/main/pages/warsh_muthamma_png/page485.png
```

أي أن التطبيق يحمّل الصفحات مباشرة كملفات منفصلة، مع توازي مناسب لتسريع العملية. التوصية الحالية لهذه الطبعة هي `8` طلبات متوازية.

## بيانات الآيات

قاعدة بيانات تحديد الآيات الخاصة بهذه الطبعة تُحمَّل من:

```text
https://raw.githubusercontent.com/youssef1817/warsh-muthamma-assets/main/databases/ayahinfo/warsh_muthamma/ayahinfo_muthamma.zip
```

أما قاعدة النص والبحث `quran.ar.warsh.db` فلا تُكرر في هذا المستودع، بل يعيد التطبيق استخدام النسخة الأصلية الخاصة بورش:

- إن كانت موجودة محليا استُعملت مباشرة.
- وإن لم تكن موجودة يحمّلها التطبيق من مصدر ورش الأصلي.

## ملاحظات دمج مهمة

- هذه الطبعة تملك `485` صفحة فقط، لذلك يجب ألا تُعامل كطبعة `604` صفحة.
- لا ينبغي إعادة تفعيل منطق تنزيل أرشيف صفحات لهذه الطبعة.
- وجود `ayahinfo_muthamma.zip` مقصود لأنه مطلوب لبيانات التحديد، وهو ليس بديلا عن التنزيل المباشر للصفحات.
