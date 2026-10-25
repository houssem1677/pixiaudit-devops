"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  ClipboardList,
  LogOut,
  ChevronLeft,
  Settings,
  Users,
} from "lucide-react";

const NAV = [
  { icon: Search, label: "Nouvel Audit", href: "/dashboard/new" },
  { icon: ClipboardList, label: "Mes Audits", href: "/dashboard/audits" },
  { icon: Settings, label: "Paramètres", href: "/dashboard/settings" },
  { icon: Users, label: "Utilisateurs", href: "/dashboard/admin/users", adminOnly: true },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [userName, setUserName] = useState("...");
  const [userInitial, setUserInitial] = useState("?");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("access_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    const name = localStorage.getItem("user_name") || "Utilisateur";
    const role = localStorage.getItem("user_role") || "USER";

    setUserName(name.split(" ")[0]);
    setUserInitial(name.charAt(0).toUpperCase());
    setUserRole(role);
    setIsLoading(false);
  }, [router]);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_name");
      localStorage.removeItem("user_role");
    }
    router.push("/login");
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-[#79C300] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <aside
        className="relative flex flex-col flex-shrink-0 transition-all duration-300"
        style={{
          width: collapsed ? "72px" : "240px",
          background: "#fff",
          borderRight: "1px solid #d1fae5",
          boxShadow: "2px 0 12px rgba(0,0,0,0.04)",
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-5 py-5 border-b"
          style={{ borderColor: "#d1fae5", height: "72px" }}
        >
          <img
            src="/logo.jpg"
            alt="PixiAudit Logo"
            className="flex-shrink-0"
            style={{ width: "36px", height: "36px", objectFit: "contain" }}
          />
          {!collapsed && (
            <span
              style={{
                fontFamily: "'Syne', sans-serif",
                fontWeight: 800,
                fontSize: "18px",
                letterSpacing: "-0.02em",
                color: "#14532d",
                whiteSpace: "nowrap",
              }}
            >
              Pixi<span style={{ color: "#16a34a" }}>Audit</span>
            </span>
          )}
        </div>

        {/* Collapse button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center z-10 transition-colors"
          style={{ background: "#fff", border: "1px solid #d1fae5", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}
        >
          <ChevronLeft
            size={12}
            style={{
              color: "#16a34a",
              transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.3s",
            }}
          />
        </button>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV.map(({ icon: Icon, label, href, adminOnly }) => {
            if (adminOnly && userRole !== "ADMIN") return null;
            
            const active = pathname === href || (href !== "/dashboard" && pathname?.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group relative"
                style={{
                  background: active ? "#dcfce7" : "transparent",
                  color: active ? "#16a34a" : "#6b7280",
                }}
              >
                {active && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full"
                    style={{ background: "#16a34a" }}
                  />
                )}
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} className="flex-shrink-0" />
                {!collapsed && (
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: active ? 600 : 400,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </span>
                )}
                {collapsed && (
                  <div
                    className="absolute left-full ml-2 px-2 py-1 rounded-lg text-xs pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50"
                    style={{ background: "#14532d", color: "white", fontSize: "12px" }}
                  >
                    {label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t" style={{ borderColor: "#d1fae5" }}>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full hover:bg-red-50 cursor-pointer transition-colors"
            style={{ background: "transparent" }}
          >
            <div
              className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}
            >
              {userInitial}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0 text-left">
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#14532d", lineHeight: 1.2 }}>{userName}</p>
                <p style={{ fontSize: "11px", color: "#6b7280", lineHeight: 1.2 }}>PixiMind</p>
              </div>
            )}
            {!collapsed && <LogOut size={14} style={{ color: "#ef4444", flexShrink: 0 }} />}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-auto">
        <header
          className="flex items-center justify-between px-8 bg-white border-b"
          style={{ minHeight: "72px", borderColor: "#d1fae5", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
        >
          <div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 900, color: "#14532d" }}>
              Bienvenue, {userName}
            </h1>
          </div>
          <div />
        </header>
        {children}
      </div>
    </div>
  );
}