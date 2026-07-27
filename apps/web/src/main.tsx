import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ToastProvider } from "./components/Toaster.tsx";
import PasswordGate from "./components/PasswordGate.tsx";

// The gate wraps everything so App never mounts — and never fires an API call —
// before the shared password has been accepted.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PasswordGate>
      <ToastProvider>
        <App />
      </ToastProvider>
    </PasswordGate>
  </StrictMode>,
);
