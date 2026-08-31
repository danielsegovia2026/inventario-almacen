import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Error en la app:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ background: "#15171B", color: "#ECEBE6", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
          <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Algo fallo al cargar la app</h2>
            <p style={{ fontSize: 13, color: "#8B8F94", marginBottom: 12 }}>
              Copia este mensaje y compartelo para poder corregirlo:
            </p>
            <pre style={{ fontSize: 12, background: "#1D2025", padding: 12, borderRadius: 8, overflowX: "auto", whiteSpace: "pre-wrap" }}>
              {String(this.state.error?.message || this.state.error)}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
