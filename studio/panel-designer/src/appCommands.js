// Shared app command bridge for UI surfaces that still communicate via window events.
const AppCommands = Object.freeze({
  closeLeftPanel() {
    window.dispatchEvent(new Event("close-left-panel"));
  },

  openComponentLibraryPicker() {
    window.dispatchEvent(new CustomEvent("open-component-library-picker"));
  },

  openTemplatesDialog() {
    window.dispatchEvent(new CustomEvent("open-template-dialog"));
  },

  toggleViewContrast() {
    window.dispatchEvent(new Event("panel-designer:toggle-view-contrast"));
  },

  openMobilePartSheet() {
    window.dispatchEvent(new Event("mobile-open-part-sheet"));
  },

  openMobileQuickLabelEdit() {
    window.dispatchEvent(new Event("mobile-quick-label-edit"));
  },

  openAppearance() {
    window.dispatchEvent(new Event("panel-designer:open-appearance"));
  },
});
