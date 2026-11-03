(function () {
  function note(kind, msg) {
    document.documentElement.setAttribute(
      "data-panel-designer-runtime-error",
      kind,
    );
    var text = kind + ": " + String(msg || "unknown error");
    try {
      localStorage.setItem(
        "eurorack_panel_designer_last_runtime_error",
        JSON.stringify({
          kind: kind,
          message: String(msg || ""),
          version:
            (window.__EURORACK_PANEL_DESIGNER_BUILD__ || {}).version || "",
          at: new Date().toISOString(),
        }),
      );
    } catch (e) {}
    if (window.appNotify)
      window.appNotify(text, {
        type: "error",
        title: "Runtime error",
        timeout: 9000,
      });
    else console.error(text);
  }
  window.addEventListener("error", function (e) {
    note("error", e && e.message);
  });
  window.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason;
    note("promise", (r && (r.stack || r.message)) || r);
  });
})();
