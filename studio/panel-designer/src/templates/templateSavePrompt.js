function appTemplateSavePrompt(opts) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "app-native-modal-backdrop";
    const artworkRow =
      opts.kind === "panel"
        ? `<label class="app-native-check-row"><input class="tpl-include-artwork" type="checkbox" /><span>Include artwork/images <small>can make templates very large</small></span></label>`
        : "";
    backdrop.innerHTML = `
      <div class="app-native-modal-card app-template-save-card" role="dialog" aria-modal="true">
        <div class="app-native-modal-title"></div>
        <div class="app-native-modal-subtitle"></div>
        <label class="app-native-modal-label">Template name</label>
        <input class="app-template-name app-native-modal-input" type="text" />
        <label class="app-native-modal-label">Description / notes</label>
        <textarea class="app-template-description app-native-modal-input" rows="4"></textarea>
        <div class="app-template-options">
          <label class="app-native-check-row"><input class="tpl-include-text" type="checkbox" checked /><span>Include text labels</span></label>
          <label class="app-native-check-row"><input class="tpl-include-scales" type="checkbox" checked /><span>Include scales</span></label>
          ${artworkRow}
        </div>
        <div class="app-native-modal-actions">
          <button class="app-native-modal-cancel">Cancel</button>
          <button class="app-native-modal-confirm primary">Save template</button>
        </div>
      </div>
    `;
    const title = backdrop.querySelector(".app-native-modal-title");
    const subtitle = backdrop.querySelector(".app-native-modal-subtitle");
    const nameInput = backdrop.querySelector(".app-template-name");
    const descInput = backdrop.querySelector(".app-template-description");
    const includeText = backdrop.querySelector(".tpl-include-text");
    const includeScales = backdrop.querySelector(".tpl-include-scales");
    const includeArtwork = backdrop.querySelector(".tpl-include-artwork");
    const cancel = backdrop.querySelector(".app-native-modal-cancel");
    const confirm = backdrop.querySelector(".app-native-modal-confirm");
    title.textContent =
      opts.kind === "block" ? "Save selected block" : "Save current panel";
    subtitle.textContent =
      opts.kind === "block"
        ? "Save the selected components as a reusable block template."
        : "Save the current panel layout as a local browser template.";
    nameInput.value = opts.defaultName;
    let done = false;
    const close = (value) => {
      if (done) return;
      done = true;
      backdrop.classList.add("leaving");
      window.setTimeout(() => {
        backdrop.remove();
        resolve(value);
      }, 130);
    };
    const submit = () => {
      const name = nameInput.value.trim();
      if (!name) return;
      close({
        name,
        description: descInput.value.trim(),
        includeText: includeText.checked,
        includeScales: includeScales.checked,
        includeArtwork: !!includeArtwork?.checked,
      });
    };
    backdrop.addEventListener("pointerdown", (e) => {
      if (e.target === backdrop) close(null);
    });
    cancel.addEventListener("click", () => close(null));
    confirm.addEventListener("click", submit);
    nameInput.addEventListener("input", () => {
      confirm.disabled = !nameInput.value.trim();
    });
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close(null);
      if (e.key === "Enter") submit();
    });
    descInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close(null);
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
    });
    document.body.appendChild(backdrop);
    window.setTimeout(() => {
      nameInput.focus();
      nameInput.select();
      confirm.disabled = !nameInput.value.trim();
    }, 0);
  });
}
