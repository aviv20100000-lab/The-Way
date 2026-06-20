'use client';

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CSRFTokenProvider } from "@/components/CSRFTokenProvider";
import PwaRegister from "./pwa-register";

export function RootLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <CSRFTokenProvider />
      <PwaRegister />
      {children}
    </ErrorBoundary>
  );
}
