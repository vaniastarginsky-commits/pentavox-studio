window.renderPanelDesignerCdnError = function renderPanelDesignerCdnError() {
  document.documentElement.setAttribute(
    "data-panel-designer-runtime-error",
    "cdn",
  );
  document.documentElement.setAttribute("data-panel-designer-cdn", "error");
  var root = document.getElementById("root");
  if (root)
    root.innerHTML =
      '<div style="min-height:100vh;background:#020202;color:#eee7da;font:13px/1.45 Inter,system-ui,sans-serif;padding:18px;display:grid;place-items:center"><div style="max-width:720px;border:1px solid rgba(215,196,155,.24);background:linear-gradient(135deg,rgba(11,11,10,.98),rgba(4,4,4,.98));padding:16px"><div style="color:#d6aa58;font-weight:800;letter-spacing:.14em;text-transform:uppercase;margin-bottom:8px">CDN load error</div><div style="color:#928b7d">React failed to load from unpkg.com. Check connection/CDN access or host the dependencies locally.</div><div style="color:#5f5a50;font-size:10px;margin-top:10px;letter-spacing:.08em">v451_mobile_canvas_dock_cleanup</div></div></div>';
};

window.renderPanelDesignerStartupError =
  function renderPanelDesignerStartupError(err) {
    try {
      console.error(err);
      var root = document.getElementById("root");
      if (root) {
        var msg = String((err && (err.stack || err.message)) || err).replace(
          /[&<>]/g,
          function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
          },
        );
        root.innerHTML =
          '<div style="min-height:100vh;background:#020202;color:#eee7da;font:13px/1.45 Inter,system-ui,sans-serif;padding:18px"><div style="max-width:760px;margin:8vh auto;border:1px solid rgba(215,196,155,.24);background:linear-gradient(135deg,rgba(11,11,10,.98),rgba(4,4,4,.98));padding:16px"><div style="color:#d6aa58;font-weight:800;letter-spacing:.14em;text-transform:uppercase;margin-bottom:8px">Panel Designer startup error</div><div style="color:#5f5a50;font-size:10px;margin:-2px 0 10px;letter-spacing:.08em">v451_mobile_canvas_dock_cleanup</div><div style="color:#928b7d;margin-bottom:12px">The app failed to initialize. Copy this message when reporting the issue.</div><pre style="white-space:pre-wrap;color:#efc2bc;background:#100807;border:1px solid rgba(138,48,42,.44);padding:12px;overflow:auto">' +
          msg +
          "</pre></div></div>";
      }
    } catch (e) {}
  };
