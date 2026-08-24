import type { ReactNode } from "react";
import { TabBar } from "./TabBar";
import { GameBanner } from "./GameBanner";
import "./AppShell.css";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <GameBanner />
      <main className="shell__main">{children}</main>
      <TabBar />
    </div>
  );
}
