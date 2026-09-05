import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ROUTES } from "../../constants/routes";

export default function UserMenu() {
  let user: any = null;
  let logout: () => any = () => {};
  try {
    const auth = useAuth();
    user = auth.user;
    logout = auth.logout;
  } catch {
    // Safe fallback if rendered without AuthProvider in unit tests
  }
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const displayName =
    user?.full_name ||
    user?.username ||
    user?.email ||
    "Trader";

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN);
  };

  const rawRole = user?.role ? String(user.role).toUpperCase() : "";
  const isAdmin = rawRole === "ADMIN" || rawRole.includes("ADMIN");
  const roleLabel = isAdmin ? "ADMIN" : "TRADER";

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 11px",
          borderRadius: 10,
          border: "1px solid rgba(148,163,184,.16)",
          background: "rgba(15,23,42,.7)",
          color: "#e2e8f0",
          cursor: "pointer",
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            display: "grid",
            placeItems: "center",
            borderRadius: "50%",
            background: isAdmin ? "linear-gradient(135deg,#f59e0b,#ef4444)" : "linear-gradient(135deg,#38bdf8,#6366f1)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          {displayName.slice(0, 1).toUpperCase()}
        </span>

        <span
          style={{
            maxWidth: 130,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 12,
            fontWeight: 750,
          }}
        >
          {displayName}
        </span>

        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            padding: "2px 6px",
            borderRadius: 4,
            background: isAdmin ? "rgba(245,158,11,0.2)" : "rgba(56,189,248,0.15)",
            color: isAdmin ? "#fbbf24" : "#38bdf8",
            border: isAdmin ? "1px solid rgba(245,158,11,0.35)" : "1px solid rgba(56,189,248,0.25)",
            letterSpacing: "0.04em",
          }}
        >
          {roleLabel}
        </span>

        <span style={{ color: "#64748b" }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            minWidth: 210,
            zIndex: 100,
            padding: 8,
            borderRadius: 12,
            border: "1px solid rgba(148,163,184,.18)",
            background: "#0f172a",
            boxShadow: "0 18px 45px rgba(0,0,0,.35)",
          }}
        >
          <div style={{ padding: "6px 10px 10px 10px", borderBottom: "1px solid rgba(148,163,184,0.12)", marginBottom: 6 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#f8fafc" }}>{displayName}</p>
            <p style={{ margin: "2px 0 0 0", fontSize: 11, color: "#94a3b8" }}>{user?.email || ""}</p>
          </div>

          {isAdmin && (
            <div style={{ marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid rgba(148,163,184,0.12)" }}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate(ROUTES.ADMIN_DASHBOARD);
                }}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  textAlign: "left",
                  border: 0,
                  borderRadius: 8,
                  background: "rgba(245,158,11,0.12)",
                  color: "#fbbf24",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>🛡️</span> Admin Console
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate(ROUTES.DASHBOARD);
            }}
            style={{
              width: "100%",
              padding: "9px 10px",
              textAlign: "left",
              border: 0,
              borderRadius: 8,
              background: "transparent",
              color: "#cbd5e1",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Dashboard
          </button>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate(ROUTES.PORTFOLIO);
            }}
            style={{
              width: "100%",
              padding: "9px 10px",
              textAlign: "left",
              border: 0,
              borderRadius: 8,
              background: "transparent",
              color: "#cbd5e1",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Portfolio
          </button>

          <button
            type="button"
            onClick={handleLogout}
            style={{
              width: "100%",
              marginTop: 4,
              padding: "9px 10px",
              textAlign: "left",
              border: 0,
              borderRadius: 8,
              background: "rgba(248,113,113,.08)",
              color: "#f87171",
              cursor: "pointer",
              fontWeight: 750,
              fontSize: 12,
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
