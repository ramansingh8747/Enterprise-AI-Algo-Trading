import React, { useState } from "react";
import Sidebar from "../dashboard/Sidebar";
import { Navbar } from "../dashboard/Navbar";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleSidebar = () => {
    if (window.innerWidth <= 900) {
      setMobileOpen((value) => !value);
    } else {
      setCollapsed((value) => {
        const next = !value;
        try {
          localStorage.setItem("sidebar_collapsed", String(next));
        } catch {}
        return next;
      });
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        background: "radial-gradient(ellipse at 15% 0%, rgba(14, 165, 233, 0.09) 0%, transparent 55%), radial-gradient(ellipse at 85% 15%, rgba(99, 102, 241, 0.08) 0%, transparent 50%), #020617",
        color: "#f8fafc",
        overflowX: "hidden",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2, 6, 23, 0.8)",
            backdropFilter: "blur(4px)",
            zIndex: 140,
          }}
        />
      )}

      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggle={toggleSidebar}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Navbar
          onMenuClick={toggleSidebar}
          onSidebarToggle={toggleSidebar}
        />

        <main className="app-main-content">
          <div
            style={{
              width: "100%",
              maxWidth: "1540px",
              margin: "0 auto",
            }}
          >
            {children}
          </div>
        </main>

        <footer className="app-footer">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontWeight: 700, color: "#94a3b8" }}>
              ⚡ AntigravityAlgo Enterprise Quant
            </span>
            <span>•</span>
            <span>v2.5.0 Production Ready</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
            <span style={{ color: "#a7f3d0", fontWeight: 600 }}>
              Paper Trading Active • Real Money Trading Gated
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
