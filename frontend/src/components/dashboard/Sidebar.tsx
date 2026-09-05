import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/context/AuthContext";

interface SidebarProps {
  collapsed: boolean;
  mobileOpen?: boolean;
  onToggle: () => void;
  onCloseMobile?: () => void;
}

export default function Sidebar({
  collapsed,
  mobileOpen = false,
  onToggle,
  onCloseMobile,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const items = [
    {
      label: "Dashboard",
      icon: "⌂",
      path: ROUTES.DASHBOARD,
    },
    {
      label: "Markets",
      icon: "▥",
      path: ROUTES.WATCHLIST,
    },
    {
      label: "Strategy",
      icon: "◎",
      path: ROUTES.STRATEGY,
    },
    {
      label: "Portfolio",
      icon: "▣",
      path: ROUTES.PORTFOLIO,
    },
    {
      label: "Orders",
      icon: "☷",
      path: ROUTES.ORDERS,
    },
    {
      label: "Journal",
      icon: "▤",
      path: ROUTES.JOURNAL,
    },
    {
      label: "Brokers",
      icon: "♙",
      path: ROUTES.BROKERS,
    },
    ...(user?.role === 'ADMIN' ? [{
      label: "Admin Console",
      icon: "⚙",
      path: ROUTES.KILL_SWITCH,
    }] : []),
  ];

  const isActive = (path: string) => {
    if (path === ROUTES.DASHBOARD) {
      return location.pathname === path;
    }
    if (path === ROUTES.STRATEGY || path === '/strategies' || path === '/strategy') {
      return location.pathname.startsWith('/strategies') || location.pathname.startsWith('/strategy');
    }
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      className={`app-sidebar ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-mobile-open" : ""}`}
      style={{
        width: collapsed ? 72 : 250,
        flexShrink: 0,
        minHeight: "100vh",
        background: "linear-gradient(180deg,#07111f 0%,#040a14 100%)",
        borderRight: "1px solid rgba(148,163,184,.12)",
        transition: "width .2s ease, transform .2s ease",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh",
        zIndex: 100,
      }}
    >
      {/* Top Logo / Brand */}
      <div
        style={{
          height: 72,
          padding: collapsed ? "0 12px" : "0 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          borderBottom: "1px solid rgba(148,163,184,.10)",
          background: "rgba(15, 23, 42, 0.4)",
        }}
      >
        <button
          type="button"
          onClick={() => navigate(ROUTES.DASHBOARD)}
          aria-label="Go to dashboard"
          style={{
            border: 0,
            background: "transparent",
            color: "#f8fafc",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 12,
            minWidth: 0,
            padding: 0,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(135deg, #0284c7 0%, #3b82f6 50%, #6366f1 100%)",
              boxShadow: "0 0 16px rgba(56, 189, 248, 0.35)",
              fontSize: 18,
              fontWeight: 900,
              flexShrink: 0,
            }}
          >
            ⚡
          </div>

          {!collapsed && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left" }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 900,
                  letterSpacing: "-0.02em",
                  color: "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                ANTIGRAVITY
                <span style={{ color: "#38bdf8", fontWeight: 800 }}>ALGO</span>
              </div>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  color: "#94a3b8",
                  textTransform: "uppercase",
                }}
              >
                Enterprise Quant AI
              </span>
            </div>
          )}
        </button>

        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {mobileOpen && (
              <button
                type="button"
                onClick={onCloseMobile || onToggle}
                aria-label="Close mobile navigation"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 6,
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  background: "rgba(239, 68, 68, 0.15)",
                  color: "#fca5a5",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                ✕
              </button>
            )}
            <button
              type="button"
              onClick={onToggle}
              aria-label="Collapse sidebar"
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: "1px solid rgba(148,163,184,.14)",
                background: "#1e293b",
                color: "#94a3b8",
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                fontSize: 14,
                transition: "all 0.15s ease",
              }}
            >
              ‹
            </button>
          </div>
        )}
      </div>

      {collapsed && (
        <button
          type="button"
          onClick={onToggle}
          aria-label="Expand sidebar"
          style={{
            margin: "14px auto 8px",
            width: 38,
            height: 34,
            borderRadius: 8,
            border: "1px solid rgba(148,163,184,.14)",
            background: "#111827",
            color: "#94a3b8",
            cursor: "pointer",
          }}
        >
          ›
        </button>
      )}

      {/* Navigation Items */}
      <nav
        style={{
          flex: 1,
          padding: "16px 12px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        {items.map((item) => {
          const active = isActive(item.path);

          return (
            <button
              key={item.path}
              type="button"
              onClick={() => {
                navigate(item.path);
                if (window.innerWidth <= 900) {
                  onCloseMobile?.();
                }
              }}
              title={collapsed ? item.label : undefined}
              style={{
                width: "100%",
                height: 44,
                borderRadius: 9,
                border: active
                  ? "1px solid rgba(56,189,248,.35)"
                  : "1px solid transparent",
                background: active
                  ? "linear-gradient(90deg, rgba(14,165,233,.22) 0%, rgba(37,99,235,.08) 100%)"
                  : "transparent",
                color: active ? "#ffffff" : "#94a3b8",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: collapsed ? "center" : "flex-start",
                gap: 12,
                padding: collapsed ? 0 : "0 14px",
                fontSize: 13,
                fontWeight: active ? 800 : 600,
                transition: "all .15s ease",
                position: "relative",
              }}
            >
              {active && !collapsed && (
                <div
                  style={{
                    position: "absolute",
                    left: -2,
                    top: "22%",
                    height: "56%",
                    width: "3px",
                    borderRadius: "2px",
                    background: "#38bdf8",
                    boxShadow: "0 0 8px #38bdf8",
                  }}
                />
              )}

              <span
                style={{
                  width: 22,
                  textAlign: "center",
                  fontSize: 16,
                  color: active ? "#38bdf8" : "#64748b",
                  filter: active ? "drop-shadow(0 0 6px rgba(56,189,248,0.5))" : "none",
                }}
              >
                {item.icon}
              </span>

              {!collapsed && (
                <span style={{ letterSpacing: "-0.01em", flex: 1, textAlign: "left" }}>
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Paper Mode Sandbox Widget */}
      <div
        style={{
          padding: collapsed ? "8px" : "12px 14px",
          margin: collapsed ? "6px" : "10px 12px",
          borderRadius: 10,
          border: "1px solid rgba(245,158,11,.22)",
          background: "linear-gradient(135deg, rgba(245,158,11,.09) 0%, rgba(15,23,42,.6) 100%)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            color: "#fbbf24",
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#4ade80", fontSize: 8 }}>●</span>
            {!collapsed && <span>SANDBOX MODE</span>}
          </div>
          {!collapsed && (
            <span style={{ fontSize: 9, background: "rgba(245,158,11,.2)", padding: "1px 6px", borderRadius: 4, color: "#fcd34d" }}>
              SAFE
            </span>
          )}
        </div>

        {!collapsed && (
          <div
            style={{
              marginTop: 6,
              color: "#94a3b8",
              fontSize: 10.5,
              lineHeight: 1.4,
            }}
          >
            Virtual balance • Real trading safely disabled.
          </div>
        )}
      </div>

      {/* Collapse Toggle at Bottom */}
      <div style={{ padding: "10px", borderTop: "1px solid rgba(148,163,184,.10)" }}>
        <button
          type="button"
          onClick={onToggle}
          style={{
            width: "100%",
            padding: "8px",
            background: "transparent",
            border: "none",
            color: "#64748b",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: "8px",
          }}
        >
          <span>{collapsed ? "»" : "«"}</span>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
