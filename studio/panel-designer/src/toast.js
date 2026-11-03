(function () {
  if (window.__panelDesignerToastInstalled) return;
  window.__panelDesignerToastInstalled = true;
  function ensureStack() {
    var stack = document.querySelector(".app-toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "app-toast-stack";
      stack.setAttribute("aria-live", "polite");
      stack.setAttribute("aria-atomic", "false");
      document.body.appendChild(stack);
    }
    return stack;
  }
  function classify(message) {
    var m = String(message || "").toLowerCase();
    if (
      /(error|failed|could not|invalid|corrupt|missing|no |cannot|can't)/.test(
        m,
      )
    )
      return "error";
    if (/(warning|check|select|nothing|empty|limit)/.test(m)) return "warning";
    return "info";
  }
  function dismiss(el) {
    if (!el || el.dataset.leaving) return;
    el.dataset.leaving = "1";
    el.classList.add("is-leaving");
    setTimeout(function () {
      el.remove();
    }, 170);
  }
  window.appNotify = function (message, options) {
    options = options || {};
    var text = String(message == null ? "" : message);
    var type = options.type || classify(text);
    var stack = ensureStack();
    while (stack.children.length >= 4) dismiss(stack.firstElementChild);
    var el = document.createElement("div");
    el.className =
      "app-toast " +
      (type === "error" ? "is-error" : type === "warning" ? "is-warning" : "");
    var title =
      options.title ||
      (type === "error"
        ? "Notice"
        : type === "warning"
          ? "Heads up"
          : "Panel Designer");
    el.innerHTML = "<strong></strong><span></span>";
    el.querySelector("strong").textContent = title;
    el.querySelector("span").textContent = text;
    el.addEventListener("click", function () {
      dismiss(el);
    });
    stack.appendChild(el);
    var ms = Number(options.timeout || (type === "error" ? 5600 : 3600));
    if (ms > 0)
      setTimeout(function () {
        dismiss(el);
      }, ms);
    return el;
  };
  var nativeAlert = window.alert ? window.alert.bind(window) : null;
  window.__nativePanelAlert = nativeAlert;
  window.alert = function (message) {
    try {
      window.appNotify(message, { type: classify(message) });
      console.info("[Panel Designer alert]", message);
    } catch (err) {
      if (nativeAlert) nativeAlert(message);
    }
  };
})();
