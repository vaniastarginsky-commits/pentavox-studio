(function () {
  setTimeout(function () {
    if (
      document.documentElement.getAttribute("data-panel-designer-ready") ===
      "true"
    )
      return;
    var root = document.getElementById("root");
    if (!root) return;
    root.innerHTML =
      '<div style="min-height:100vh;background:#020202;color:#eee7da;font:13px/1.45 Inter,system-ui,sans-serif;padding:18px;display:grid;place-items:center"><div style="max-width:720px;border:1px solid rgba(215,196,155,.24);background:linear-gradient(135deg,rgba(11,11,10,.98),rgba(4,4,4,.98));padding:16px"><div style="color:#d6aa58;font-weight:800;letter-spacing:.14em;text-transform:uppercase;margin-bottom:8px">Still loading</div><div style="color:#928b7d">The app has not started yet. If this stays visible, check your connection to the React CDN or reload the file.</div></div></div>';
  }, 7000);
})();
