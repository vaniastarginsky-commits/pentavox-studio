// Structural workspace wrapper. Keeps sidebar layout state explicit for CSS.
function WorkspaceShell({ leftOpen, rightOpen, isMobile, children }) {
  return React.createElement(
    "div",
    {
      className: "workspace",
      "data-left-open": leftOpen ? "true" : "false",
      "data-right-open": rightOpen ? "true" : "false",
      "data-mobile": isMobile ? "true" : "false",
    },
    children,
  );
}
