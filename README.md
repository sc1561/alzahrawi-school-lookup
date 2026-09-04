# موقع الاستعلام عن بيانات الطالب — مدرسة أبو القاسم الزهراوي

نظام بسيط للاستعلام عن بيانات الطالب (الصف والشعبة) عبر إدخال الاسم الثلاثي.
مبني بـ HTML و CSS و JavaScript فقط، بدون أي مكتبات خارجية أو قاعدة بيانات.

## الملفات

- `index.html` — هيكل الصفحة
- `style.css` — التنسيق (متجاوب بالكامل، RTL، خطوط Cairo/Tajawal)
- `script.js` — منطق البحث والتحقق والرسائل
- `data.js` — بيانات الطلاب (خمسة أسماء وهمية للتجربة)
- `images/school-logo.png` — شعار المدرسة

## رفع المشروع إلى GitHub

```bash
cd alzahrawi-school-lookup
git init
git add .
git commit -m "الإصدار الأول: نظام الاستعلام عن بيانات الطالب"
git branch -M main
git remote add origin https://github.com/<اسم-حسابك>/alzahrawi-school-lookup.git
git push -u origin main
```

## النشر

**GitHub Pages:**
Settings → Pages → Branch: `main` → Folder: `/root` → Save.
سيصبح الموقع متاحًا على: `https://<اسم-حسابك>.github.io/alzahrawi-school-lookup/`

**Render (Static Site):**
1. New → Static Site → اختر المستودع `alzahrawi-school-lookup`
2. Build Command: اتركه فارغًا
3. Publish Directory: `.`

## إضافة أو تعديل بيانات الطلاب

افتح `data.js` وأضف عنصرًا جديدًا بنفس الصيغة:

```js
{
  id: "1006",
  last4: "1234",
  name: "اسم الطالب الكامل",
  grade: "الصف",
  section: "الشعبة"
}
```

## ملاحظات هامة قبل الاستخدام الفعلي

- استبدل الأسماء الوهمية الخمسة ببيانات الطلاب الحقيقية قبل النشر الفعلي.
- لا يوجد اتصال بقاعدة بيانات خارجية في هذه النسخة؛ البيانات مخزّنة داخل `data.js` مباشرة، لذا يُفضّل عدم استخدام هذه الطريقة لعدد كبير جدًا من الطلاب أو للمعلومات شديدة الحساسية على المدى الطويل.
- تم ضبط حد أقصى للمحاولات المتتالية (6 محاولات) مع قفل مؤقت 30 ثانية كحماية أساسية.
