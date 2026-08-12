import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";

interface SidebarProps {
  collapsed: boolean;
  mobileOpen?: boolean;
  onToggle: () => void;
}

export default function Sidebar({
  collapsed,
  mobileOpen = false,
  onToggle,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

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
  ];

  const isActive = (path: string) => {
    if (path === ROUTES.DASHBOARD) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <aside
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
        transform: mobileOpen ? "translateX(0)" : undefined,
      }}
    >
      {/* Top Logo / Brand */}
      <div
        style={{
          height: 72,
          padding: collapsed ? "0 14px" : "0 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          borderBottom: "1px solid rgba(148,163,184,.10)",
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
            gap: 10,
            minWidth: 0,
          }}
        >
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(135deg,#0284c7,#2563eb)",
              fontSize: 17,
              fontWeight: 900,
            }}
          >
            ⚡
          </span>

          {!collapsed && (
            <span
              style={{
                fontSize: 16,
                fontWeight: 900,
                whiteSpace: "nowrap",
              }}
            >
              Antigravity
              <span style={{ color: "#38bdf8" }}>Algo</span>
            </span>
          )}
        </button>

        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              border: "1px solid rgba(148,163,184,.14)",
              background: "#111827",
              color: "#94a3b8",
              cursor: "pointer",
            }}
          >
            ‹
          </button>
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
          padding: "14px 10px",
          overflowY: "auto",
        }}
      >
        {items.map((item) => {
          const active = isActive(item.path);

          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              title={collapsed ? item.label : undefined}
              style={{
                width: "100%",
                height: 46,
                marginBottom: 5,
                borderRadius: 10,
                border: active
                  ? "1px solid rgba(56,189,248,.30)"
                  : "1px solid transparent",
                background: active
                  ? "linear-gradient(90deg,rgba(14,165,233,.30),rgba(37,99,235,.12))"
                  : "transparent",
                color: active ? "#ffffff" : "#94a3b8",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: collapsed ? "center" : "flex-start",
                gap: 12,
                padding: collapsed ? 0 : "0 13px",
                fontSize: 13,
                fontWeight: active ? 800 : 650,
                transition: "background .15s ease,color .15s ease",
              }}
            >
              <span
                style={{
                  width: 24,
                  textAlign: "center",
                  fontSize: 17,
                  color: active ? "#38bdf8" : "#64748b",
                }}
              >
                {item.icon}
              </span>

              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Paper Mode Card */}
      <div
        style={{
          padding: collapsed ? 10 : 14,
          margin: collapsed ? 0 : 10,
          borderRadius: 12,
          border: "1px solid rgba(245,158,11,.18)",
          background: "rgba(245,158,11,.07)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: 7,
            color: "#fbbf24",
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          <span>●</span>
          {!collapsed && <span>PAPER MODE</span>}
        </div>

        {!collapsed && (
          <>
            <div
              style={{
                marginTop: 8,
                color: "#cbd5e1",
                fontSize: 11,
                lineHeight: 1.5,
              }}
            >
              Orders are simulated.
              <br />
              No real money at risk.
            </div>

            <div
              style={{
                marginTop: 8,
                color: "#4ade80",
                fontSize: 10,
                fontWeight: 800,
              }}
            >
              ● Simulation Active
            </div>
          </>
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
