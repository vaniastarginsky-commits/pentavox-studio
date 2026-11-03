class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { error, info: null };
  }
  componentDidCatch(error, info) {
    console.error("Panel Designer render error:", error, info);
    this.setState({ error, info });
  }
  render() {
    if (this.state.error) {
      const message = this.state.error.message || String(this.state.error);
      const stack = this.state.error.stack || "";
      return React.createElement(
        "div",
        { className: "error-boundary-screen" },
        React.createElement(
          "div",
          { className: "error-boundary-card" },
          React.createElement("h1", null, "Panel Designer crashed safely"),
          React.createElement(
            "p",
            null,
            "The app hit a render error, but the page did not go black. Your browser autosave/local project data should still be available.",
          ),
          React.createElement(
            "div",
            { className: "error-boundary-message" },
            message,
          ),
          React.createElement(
            "div",
            { className: "error-boundary-actions" },
            React.createElement(
              "button",
              { onClick: () => window.location.reload() },
              "Reload app",
            ),
            React.createElement(
              "button",
              {
                onClick: () => {
                  const text = `Panel Designer crash\n\n${message}\n\n${stack}`;
                  if (navigator.clipboard && window.isSecureContext)
                    navigator.clipboard.writeText(text).catch(() => {});
                },
              },
              "Copy error",
            ),
          ),
          stack && React.createElement("pre", null, stack),
        ),
      );
    }
    return this.props.children;
  }
}
