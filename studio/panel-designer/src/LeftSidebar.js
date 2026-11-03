// Extracted component declarations from index.html.
// LeftSidebar
function LeftSidebar({
  open,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onStartPartPlacement,
}) {
  if (!open)
    return React.createElement("div", {
      className: "sidebar-left closed lazy-unmounted",
      "aria-hidden": "true",
    });
  return React.createElement(
    "div",
    {
      className: "sidebar-left open",
      onTouchStart: onTouchStart,
      onTouchMove: onTouchMove,
      onTouchEnd: onTouchEnd,
      onTouchCancel: onTouchEnd,
    },
    React.createElement(ProjectPanel, null),
    React.createElement(PanelSettings, null),
    React.createElement(ArtworkPanel, null),
    React.createElement(TextPanel, null),
    React.createElement(ComponentLibraryPanel, {
      onStartPartPlacement: onStartPartPlacement,
    }),
  );
}
