// Root render entrypoint.
try {
  const __panelDesignerRoot = ReactDOM.createRoot(
    document.getElementById("root"),
  );
  __panelDesignerRoot.render(
    React.createElement(
      ErrorBoundary,
      null,
      React.createElement(AppProvider, null, React.createElement(App, null)),
    ),
  );
  document.documentElement.setAttribute("data-panel-designer-ready", "true");
} catch (err) {
  window.renderPanelDesignerStartupError(err);
}
