'use client';

import { ErrorBoundary } from "@/components/ErrorBoundary";
import PwaRegister from "./pwa-register";

export function RootLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <PwaRegister />
      {children}
    </ErrorBoundary>
  );
}
