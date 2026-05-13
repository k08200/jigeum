"use client";

import { useEffect } from "react";
import { AuthProvider } from "../lib/auth";
import { I18nProvider } from "../lib/i18n";
import { initSentryClient } from "../lib/sentry";
import { ConfirmProvider } from "./confirm-dialog";
import { ToastProvider } from "./toast";

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initSentryClient();
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const removeNextDevTools = () => {
      document
        .querySelectorAll(
          [
            "#next-logo",
            "[data-nextjs-dev-tools-button]",
            'button[aria-label="Open Next.js Dev Tools"]',
          ].join(","),
        )
        .forEach((node) => {
          node.remove();
        });
    };

    removeNextDevTools();
    const observer = new MutationObserver(removeNextDevTools);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <I18nProvider>
      <ToastProvider>
        <AuthProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </AuthProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
