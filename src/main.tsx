import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/nunito";
import "@fontsource-variable/noto-sans-sc";
import "@fontsource/zcool-kuaile";
import App from "./App";
import "./App.css";
import { Toaster } from "./components/ui/toaster";
import { I18nProvider } from "./i18n";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <I18nProvider>
      <App />
      <Toaster />
    </I18nProvider>
  </StrictMode>
);
