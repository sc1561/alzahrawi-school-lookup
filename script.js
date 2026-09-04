/* ============================================================
   script.js
   منطق البحث عن بيانات الطالب - مدرسة أبو القاسم الزهراوي
   ملاحظة: لا يتم حفظ أي بيانات في Local Storage، وكل شيء
   يعمل في الذاكرة المؤقتة فقط أثناء الجلسة الحالية.
   ============================================================ */

(function () {
  "use strict";

  /* ------------------ عناصر الصفحة ------------------ */
  const form           = document.getElementById("searchForm");
  const nameInput      = document.getElementById("studentName");
  const extraInput     = document.getElementById("studentExtra");
  const optionalTag    = document.getElementById("optionalTag");
  const messageBox     = document.getElementById("messageBox");
  const searchBtn      = document.getElementById("searchBtn");
  const spinner        = document.getElementById("spinner");
  const searchCard     = document.getElementById("searchCard");
  const resultCard     = document.getElementById("resultCard");
  const resultName     = document.getElementById("resultName");
  const resultGrade    = document.getElementById("resultGrade");
  const resultSection  = document.getElementById("resultSection");
  const newSearchBtn   = document.getElementById("newSearchBtn");

  /* ------------------ إعدادات الحماية ------------------ */
  const MAX_ATTEMPTS = 6;      // الحد الأقصى للمحاولات المتتالية غير الناجحة
  const LOCK_SECONDS = 30;     // مدة القفل المؤقت بعد تجاوز الحد
  let failedAttempts = 0;
  let isLocked = false;
  let pendingMultipleMatches = null; // نتائج متعددة بانتظار رقم تعريفي إضافي

  /* ============================================================
     أدوات تطبيع النص العربي (لأغراض المطابقة فقط، لا تُعرض للمستخدم)
     ============================================================ */

  // إزالة التشكيل العربي (الفتحة، الضمة، الكسرة، السكون... إلخ)
  function removeTashkeel(text) {
    return text.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
  }

  // توحيد أشكال الهمزات والألف المقصورة لتفادي اختلاف الكتابة
  function unifyHamza(text) {
    return text
      .replace(/[إأآا]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي")
      .replace(/ء/g, "");
  }

  // تطبيع كامل: إزالة تشكيل، توحيد همزات، إزالة مسافات زائدة، وتحويل لصيغة موحدة
  function normalizeText(text) {
    if (!text) return "";
    let t = text.trim();
    t = removeTashkeel(t);
    t = unifyHamza(t);
    t = t.replace(/\s+/g, " ").trim();
    return t;
  }

  function normalizeWords(text) {
    const n = normalizeText(text);
    return n.length ? n.split(" ") : [];
  }

  /* ============================================================
     منطق البحث
     ============================================================ */

  // يبحث عن كل الطلاب الذين تتطابق بداية اسمهم (بنفس الترتيب) مع الكلمات المدخلة
  function findMatches(inputName) {
    const inputWords = normalizeWords(inputName);
    if (inputWords.length === 0) return [];

    return studentsData.filter((student) => {
      const nameWords = normalizeWords(student.name);
      if (nameWords.length < inputWords.length) return false;
      for (let i = 0; i < inputWords.length; i++) {
        if (nameWords[i] !== inputWords[i]) return false;
      }
      return true;
    });
  }

  // يضيّق نتائج متعددة باستخدام الرقم التعريفي أو آخر أربعة أرقام من الرقم المدني
  function narrowByExtra(matches, extraValue) {
    const v = normalizeText(extraValue).replace(/\s/g, "");
    if (!v) return matches;
    return matches.filter((s) => s.id === v || s.last4 === v);
  }

  /* ============================================================
     رسائل الواجهة
     ============================================================ */

  function showMessage(text, type) {
    messageBox.textContent = text;
    messageBox.className = "message-box show " + (type || "");
  }

  function clearMessage() {
    messageBox.textContent = "";
    messageBox.className = "message-box";
  }

  function markFieldError(field, isError) {
    field.classList.toggle("input-error", !!isError);
  }

  function setLoading(isLoading) {
    searchBtn.disabled = isLoading;
    spinner.hidden = !isLoading;
  }

  function requireExtraField(required) {
    if (required) {
      optionalTag.textContent = "(مطلوب)";
      extraInput.setAttribute("required", "required");
    } else {
      optionalTag.textContent = "(اختياري)";
      extraInput.removeAttribute("required");
    }
  }

  /* ============================================================
     عرض النتيجة
     ============================================================ */

  function showResult(student) {
    resultName.textContent = student.name;
    resultGrade.textContent = student.grade;
    resultSection.textContent = student.section;

    resultCard.hidden = false;
    searchCard.hidden = true;

    // تمرير تلقائي وسلس إلى بطاقة النتيجة
    requestAnimationFrame(() => {
      resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function resetSearch() {
    form.reset();
    clearMessage();
    markFieldError(nameInput, false);
    markFieldError(extraInput, false);
    requireExtraField(false);
    pendingMultipleMatches = null;

    resultCard.hidden = true;
    searchCard.hidden = false;

    requestAnimationFrame(() => {
      searchCard.scrollIntoView({ behavior: "smooth", block: "start" });
      nameInput.focus();
    });
  }

  /* ============================================================
     القفل المؤقت بعد تجاوز عدد المحاولات
     ============================================================ */

  function lockSearchTemporarily() {
    isLocked = true;
    searchBtn.disabled = true;
    let remaining = LOCK_SECONDS;

    showMessage(
      "لقد تجاوزت الحد المسموح به من المحاولات. يرجى المحاولة بعد " + remaining + " ثانية.",
      ""
    );

    const timer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(timer);
        isLocked = false;
        failedAttempts = 0;
        searchBtn.disabled = false;
        clearMessage();
      } else {
        showMessage(
          "لقد تجاوزت الحد المسموح به من المحاولات. يرجى المحاولة بعد " + remaining + " ثانية.",
          ""
        );
      }
    }, 1000);
  }

  /* ============================================================
     تنفيذ البحث
     ============================================================ */

  function performSearch() {
    clearMessage();
    markFieldError(nameInput, false);
    markFieldError(extraInput, false);

    const nameValue = nameInput.value;
    const extraValue = extraInput.value;

    // التحقق من الحقل الفارغ
    if (!nameValue || !nameValue.trim()) {
      showMessage("يرجى إدخال اسم الطالب.", "");
      markFieldError(nameInput, true);
      nameInput.focus();
      return;
    }

    if (isLocked) {
      return;
    }

    setLoading(true);

    // مؤشر تحميل قصير لتحسين تجربة الانتظار (البحث محلي وفوري)
    window.setTimeout(() => {
      try {
        let matches = findMatches(nameValue);

        // تضييق النتائج إذا زوّد المستخدم بالرقم التعريفي أو آخر 4 أرقام
        if (matches.length > 1 && extraValue.trim()) {
          matches = narrowByExtra(matches, extraValue);
        }

        if (matches.length === 0) {
          failedAttempts += 1;
          showMessage(
            "عذرًا، لم يتم العثور على طالب مطابق للبيانات المدخلة. يرجى التأكد من كتابة الاسم بصورة صحيحة.",
            ""
          );
          markFieldError(nameInput, true);

          if (failedAttempts >= MAX_ATTEMPTS) {
            lockSearchTemporarily();
          }
        } else if (matches.length > 1) {
          // أكثر من طالب بنفس الاسم: نطلب رقمًا تعريفيًا إضافيًا
          pendingMultipleMatches = matches;
          requireExtraField(true);
          showMessage(
            "يوجد أكثر من طالب بالاسم نفسه، يرجى إدخال الرقم التعريفي للطالب.",
            ""
          );
          markFieldError(extraInput, true);
          extraInput.focus();
        } else {
          // نتيجة واحدة مؤكدة
          failedAttempts = 0;
          pendingMultipleMatches = null;
          clearMessage();
          showResult(matches[0]);
        }
      } catch (err) {
        showMessage("تعذر تنفيذ البحث حاليًا، يرجى المحاولة مرة أخرى.", "");
      } finally {
        setLoading(false);
      }
    }, 450);
  }

  /* ============================================================
     ربط الأحداث
     ============================================================ */

  form.addEventListener("submit", function (e) {
    e.preventDefault(); // منع إعادة تحميل الصفحة، ودعم تنفيذ البحث بزر Enter تلقائيًا
    performSearch();
  });

  newSearchBtn.addEventListener("click", resetSearch);

  // إزالة حالة الخطأ عند بدء الكتابة من جديد
  nameInput.addEventListener("input", () => markFieldError(nameInput, false));
  extraInput.addEventListener("input", () => markFieldError(extraInput, false));

})();
