import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ROUTES } from "../../constants/routes";

export default function UserMenu() {
  const { user, logout } = useAuth();
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
          padding: "8px 11px",
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
            background: "linear-gradient(135deg,#38bdf8,#6366f1)",
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

        <span style={{ color: "#64748b" }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            minWidth: 190,
            zIndex: 100,
            padding: 8,
            borderRadius: 12,
            border: "1px solid rgba(148,163,184,.18)",
            background: "#0f172a",
            boxShadow: "0 18px 45px rgba(0,0,0,.35)",
          }}
        >
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
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
