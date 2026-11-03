// v305 device/runtime tuning: classify input/performance conditions early.
(function () {
  function updateDeviceClasses() {
    var root = document.documentElement;
    var coarse =
      window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    var phone =
      window.matchMedia && window.matchMedia("(max-width: 860px)").matches;
    var tablet =
      window.matchMedia &&
      window.matchMedia("(min-width: 861px) and (max-width: 1180px)").matches;
    var reduceMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var lowMem = navigator.deviceMemory && navigator.deviceMemory <= 4;
    var lowCpu =
      navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
    var lowPower = !!(lowMem || lowCpu || reduceMotion || coarse);
    root.classList.toggle("is-coarse", !!coarse);
    root.classList.toggle("is-phone", !!phone);
    root.classList.toggle("is-tablet", !!tablet);
    root.classList.toggle("is-low-power", !!lowPower);
    root.classList.toggle("reduce-motion", !!reduceMotion);
    root.style.setProperty(
      "--vvh",
      (window.visualViewport
        ? window.visualViewport.height
        : window.innerHeight) + "px",
    );
    root.style.setProperty(
      "--vvw",
      (window.visualViewport
        ? window.visualViewport.width
        : window.innerWidth) + "px",
    );
  }
  updateDeviceClasses();
  window.addEventListener("resize", updateDeviceClasses, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", updateDeviceClasses, {
      passive: true,
    });
    window.visualViewport.addEventListener("scroll", updateDeviceClasses, {
      passive: true,
    });
  }
})();
