// Mobile Safari/Chrome can show the native “Copy / Find Selection” callout
// on long-press over SVG text/images. The app has its own long-press menu,
// so suppress browser selection/context menus inside the canvas only.
document.addEventListener("DOMContentLoaded", function () {
  function isEditorCanvasTarget(target) {
    return target && target.closest && target.closest(".canvas-wrap");
  }
  document.addEventListener(
    "contextmenu",
    function (e) {
      if (isEditorCanvasTarget(e.target)) e.preventDefault();
    },
    true,
  );
  document.addEventListener(
    "selectstart",
    function (e) {
      if (isEditorCanvasTarget(e.target)) e.preventDefault();
    },
    true,
  );
  document.addEventListener(
    "dragstart",
    function (e) {
      if (isEditorCanvasTarget(e.target)) e.preventDefault();
    },
    true,
  );
});
