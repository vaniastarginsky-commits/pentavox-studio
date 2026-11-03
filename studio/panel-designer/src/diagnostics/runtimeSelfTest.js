function runRuntimeSelfTest(state, warnings) {
  const out = [];
  function ok(message) {
    out.push({ level: "ok", message });
  }
  function warn(message) {
    out.push({ level: "warn", message });
  }
  function err(message) {
    out.push({ level: "error", message });
  }
  try {
    const widthMM = panelWidthMM(state.panel);
    Number.isFinite(widthMM) && widthMM > 0
      ? ok(`Panel width resolves to ${widthMM.toFixed(2)} mm.`)
      : err("Panel width is invalid.");
    const requiredTypes = [
      "jack",
      "pot9mm",
      "fader20",
      "fader20led",
      "slideSwitchMini",
      "tactled",
      "trimmer6mm",
      "led3mm",
    ];
    const libraryTypes = new Set(COMPONENT_LIBRARY.map((c) => c.type));
    const missingTypes = requiredTypes.filter((t) => !libraryTypes.has(t));
    missingTypes.length
      ? err(
          `Component library missing required type(s): ${missingTypes.join(", ")}.`,
        )
      : ok(
          `Component library contains ${requiredTypes.length} required baseline part types.`,
        );
    const normalized = validateAndNormalize(
      JSON.parse(serializeProject(state, true)),
    );
    normalized.ok
      ? ok("Project JSON serialize/load validation passes.")
      : err(`Project JSON validation failed: ${normalized.error}`);
    const hasLayerState =
      !!state.layerVisibility && !!state.layerOpacity && !!state.layerExport;
    hasLayerState
      ? ok("Layer Manager state is present: visibility/opacity/export flags.")
      : err("Layer Manager state is missing required fields.");
    const hwModeOk = ["auto", "classic", "realistic", "off"].includes(
      state.hardwareRenderMode || "auto",
    );
    hwModeOk
      ? ok(
          `Hardware render mode is valid: ${state.hardwareRenderMode || "auto"}.`,
        )
      : err("Hardware render mode is invalid.");
    const classicOk =
      state.topHardwareStyle === "classic" ||
      state.topHardwareStyle === "realistic";
    classicOk
      ? ok(`Hardware style state is valid: ${state.topHardwareStyle}.`)
      : err("Hardware style state is invalid.");
    const badComponents = state.components.filter(
      (c) =>
        !Number.isFinite(c.x) ||
        !Number.isFinite(c.y) ||
        !Number.isFinite(c.rotation),
    );
    badComponents.length
      ? err(
          `${badComponents.length} component(s) have invalid coordinates/rotation.`,
        )
      : ok("All placed components have finite coordinates.");
    const duplicateRefs = Array.from(
      new Set(
        state.components
          .map((c) => c.ref)
          .filter(
            (ref) =>
              ref && state.components.filter((cc) => cc.ref === ref).length > 1,
          ),
      ),
    );
    duplicateRefs.length
      ? warn(`Duplicate refs present: ${duplicateRefs.join(", ")}.`)
      : ok("No duplicate refs detected.");
    if (warnings.some((w) => w.severity === "error"))
      warn(
        "Current layout has DFM errors; runtime is OK but production is blocked.",
      );
    ok(
      "Diagnostics are lightweight; export generation is tested by using the actual Export actions.",
    );
  } catch (e) {
    err(`Diagnostics crashed: ${e?.message || String(e)}`);
  }
  return out;
}
