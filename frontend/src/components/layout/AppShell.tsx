import React, { useState } from "react";
import Sidebar from "../dashboard/Sidebar";
import { Navbar } from "../dashboard/Navbar";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleSidebar = () => {
    if (window.innerWidth <= 900) {
      setMobileOpen((value) => !value);
    } else {
      setCollapsed((value) => !value);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        background: "linear-gradient(180deg,#020617 0%,#07111f 100%)",
        color: "#f8fafc",
        overflowX: "hidden",
      }}
    >
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.65)",
            zIndex: 90,
          }}
        />
      )}

      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggle={toggleSidebar}
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

        <main
          style={{
            flex: 1,
            width: "100%",
            padding: "26px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "1500px",
              margin: "0 auto",
            }}
          >
            {children}
          </div>
        </main>

        <footer
          style={{
            padding: "18px 26px",
            borderTop: "1px solid rgba(148,163,184,.10)",
            color: "#64748b",
            fontSize: 11,
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <span>
            © 2026 AntigravityAlgo. All rights reserved.
          </span>

          <span
            style={{
              color: "#fbbf24",
            }}
          >
            Paper trading only. Real trading disabled.
          </span>
        </footer>
      </div>
    </div>
  );
}
