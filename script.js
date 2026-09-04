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
  const messageBox     = document.getElementById("messageBox");
  const searchBtn      = document.getElementById("searchBtn");
  const spinner        = document.getElementById("spinner");
  const searchCard     = document.getElementById("searchCard");
  const resultCard     = document.getElementById("resultCard");
  const resultName     = document.getElementById("resultName");
  const resultGrade    = document.getElementById("resultGrade");
  const resultSection  = document.getElementById("resultSection");
  const newSearchBtn   = document.getElementById("newSearchBtn");
  const voiceBtn       = document.getElementById("voiceBtn");
  const voiceHint      = document.getElementById("voiceHint");

  /* ------------------ إعدادات الحماية ------------------ */
  const MAX_ATTEMPTS = 20;     // عدد مريح من المحاولات المتتالية غير الناجحة
  const LOCK_SECONDS = 10;     // قفل قصير بعد تجاوز الحد
  let failedAttempts = 0;
  let isLocked = false;

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
    t = t.replace(/[،؛؟,.!ـ-]/g, " ");
    t = t.replace(/\s+/g, " ").trim();
    // قبول الاسم مع كلمة «بن» أو بدونها، وتوحيد كتابة عبدالله.
    t = t.replace(/(^|\s)بن(?=\s|$)/g, " ");
    t = t.replace(/عبد\s+الله/g, "عبدالله");
    t = t.replace(/ظ/g, "ض");
    t = t.replace(/\s+/g, " ").trim();
    return t;
  }

  /* ============================================================
     منطق البحث
     ============================================================ */

  // إنشاء بصمة مشفرة من الاسم الكامل دون كشفه في ملف البيانات
  async function createLookupKey(inputName) {
    const value = normalizeText(inputName);
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  async function findMatches(inputName) {
    const key = await createLookupKey(inputName);
    return studentsData.filter((student) => student.keys.includes(key));
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

  /* ============================================================
     عرض النتيجة
     ============================================================ */

  function showResult(student, enteredName) {
    resultName.textContent = enteredName.trim().replace(/\s+/g, " ");
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

    const nameValue = nameInput.value;

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
    window.setTimeout(async () => {
      try {
        const matches = await findMatches(nameValue);

        if (matches.length === 0) {
          failedAttempts += 1;
          showMessage(
            "عذرًا، لم يتم العثور على طالب مطابق. يرجى التأكد من كتابة الاسم الكامل كما ورد في السجل المدرسي.",
            ""
          );
          markFieldError(nameInput, true);

          if (failedAttempts >= MAX_ATTEMPTS) {
            lockSearchTemporarily();
          }
        } else if (matches.length > 1) {
          showMessage(
            "يوجد أكثر من طالب يتطابق مع هذا الاسم. يرجى إضافة جزء آخر من الاسم لتمييز الطالب المطلوب.",
            "info"
          );
          nameInput.focus();
        } else {
          failedAttempts = 0;
          clearMessage();
          showResult(matches[0], nameValue);
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

  /* ============================================================
     الكتابة بالصوت - تعمل في المتصفحات الداعمة مثل Chrome
     ============================================================ */
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    voiceBtn.disabled = true;
    voiceHint.textContent = "الكتابة بالصوت غير مدعومة في هذا المتصفح؛ يمكنك كتابة الاسم يدويًا.";
  } else {
    const recognition = new SpeechRecognition();
    recognition.lang = "ar-OM";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    voiceBtn.addEventListener("click", () => {
      clearMessage();
      try {
        recognition.start();
      } catch (error) {
        showMessage("الميكروفون يعمل بالفعل، يرجى نطق الاسم بوضوح.", "info");
      }
    });

    recognition.onstart = () => {
      voiceBtn.classList.add("listening");
      voiceHint.textContent = "جارٍ الاستماع... انطق اسم الطالب الثلاثي بوضوح.";
    };

    recognition.onresult = (event) => {
      const spokenName = event.results[0][0].transcript.trim();
      nameInput.value = spokenName;
      markFieldError(nameInput, false);
      voiceHint.textContent = "تمت كتابة الاسم. راجعه ثم اضغط على «بحث».";
      nameInput.focus();
    };

    recognition.onerror = (event) => {
      const denied = event.error === "not-allowed" || event.error === "service-not-allowed";
      showMessage(
        denied
          ? "يرجى السماح للموقع باستخدام الميكروفون لتفعيل البحث الصوتي."
          : "لم أتمكن من سماع الاسم بوضوح، يرجى المحاولة مرة أخرى.",
        ""
      );
    };

    recognition.onend = () => {
      voiceBtn.classList.remove("listening");
      if (!nameInput.value.trim()) {
        voiceHint.textContent = "يمكنك كتابة الاسم أو الضغط على الميكروفون ونطقه.";
      }
    };
  }
})();
