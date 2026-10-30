// ============================================
// PAGE : Rapport d'Audit — Détail complet (WITH PRIORITY CARDS)
// ROUTE: /dashboard/audits/[id]/report
// ============================================
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Search, Zap, ShieldCheck, ArrowLeft,
  CheckCircle2, AlertTriangle, XCircle,
  Globe, Clock, RefreshCw, ChevronDown, ChevronUp, Sparkles,
  Download, TrendingUp
} from "lucide-react";
import { getAudit } from "@/lib/api";

const TABS = [
  { id: "overview",         label: "Vue globale",        icon: Globe },
  { id: "seo",              label: "SEO",                icon: Search },
  { id: "performance",      label: "Performance",        icon: Zap },
  { id: "security",         label: "Securite",           icon: ShieldCheck },
  { id: "recommendations",  label: "Recommandations IA", icon: Sparkles },
];

function getDomain(url: string) {
  try { return new URL(url).hostname.replace("www.", ""); }
  catch { return url; }
}
function formatLocalDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
function scoreColor(s: number | null) {
  if (!s) return "#9ca3af";
  return s >= 70 ? "#16a34a" : s >= 50 ? "#ca8a04" : "#dc2626";
}

// ✅ NEW: Priority color helper
function getPriorityColor(level: string) {
  switch (level) {
    case "Critique": return { bg: "#fee2e2", color: "#dc2626", emoji: "🔴" };
    case "Important": return { bg: "#fef9c3", color: "#ca8a04", emoji: "🟡" };
    case "Amélioration": return { bg: "#dcfce7", color: "#16a34a", emoji: "🟢" };
    default: return { bg: "#f3f4f6", color: "#6b7280", emoji: "⚪" };
  }
}

function ScoreRing({ score, size = 120, stroke = 8 }: { score: number | null; size?: number; stroke?: number }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const fill = score ? (score / 100) * circ : 0;
  const color = scoreColor(score);
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${c} ${c})`} />
      <text x={c} y={c + 6} textAnchor="middle" fill={color}
        fontSize={size * 0.18} fontWeight="800">{score ?? "—"}</text>
    </svg>
  );
}

const SEO_TYPE_MAP: Record<string, { label: string; severity: "error" | "warning" | "info" }> = {
  H1_MISSING:      { label: "H1 manquant",          severity: "error" },
  META_MISSING:    { label: "Meta description abs.", severity: "error" },
  TITLE_MISSING:   { label: "Titre manquant",        severity: "error" },
  TITLE_TOO_SHORT: { label: "Titre trop court",      severity: "warning" },
  TITLE_TOO_LONG:  { label: "Titre trop long",       severity: "warning" },
  META_TOO_SHORT:  { label: "Meta trop courte",      severity: "warning" },
  META_TOO_LONG:   { label: "Meta trop longue",      severity: "warning" },
};
const PERF_TYPE_MAP: Record<string, { label: string; severity: "error" | "warning" | "info" }> = {
  HIGH_TTFB:                   { label: "TTFB élevé",             severity: "error" },
  HIGH_LCP:                    { label: "LCP élevé",              severity: "error" },
  HIGH_CLS:                    { label: "CLS élevé",              severity: "warning" },
  IMAGES_WITHOUT_LAZY_LOADING: { label: "Images sans lazy-load",  severity: "warning" },
  IMAGES_WITHOUT_DIMENSIONS:   { label: "Images sans dimensions", severity: "warning" },
  IMAGES_WITHOUT_SRCSET:       { label: "Images sans srcset",     severity: "info" },
  RENDER_BLOCKING_SCRIPTS:     { label: "Scripts bloquants",      severity: "error" },
};
const SEC_TYPE_MAP: Record<string, { label: string; severity: "error" | "warning" | "info" }> = {
  SSL_EXPIRING_SOON: { label: "SSL expire bientôt", severity: "warning" },
  MISSING_HEADER:    { label: "Header manquant",    severity: "error" },
  SSL_INVALID:       { label: "SSL invalide",       severity: "error" },
};

const SEVERITY_STYLE = {
  error:   { bg: "#fee2e2", color: "#dc2626", icon: <XCircle size={11} /> },
  warning: { bg: "#fef9c3", color: "#ca8a04", icon: <AlertTriangle size={11} /> },
  info:    { bg: "#dcfce7", color: "#16a34a", icon: <CheckCircle2 size={11} /> },
};

function AnomalyBadge({ type, map }: { type: string; map: Record<string, { label: string; severity: "error"|"warning"|"info" }> }) {
  const def = map[type] || { label: type, severity: "info" as const };
  const style = SEVERITY_STYLE[def.severity];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: style.bg, color: style.color }}>
      {style.icon} {def.label}
    </span>
  );
}

interface PageAnomaly {
  type: string;
  detail?: string;
}

interface PageSeoResult {
  anomalies?: PageAnomaly[];
  h1Count?: number;
  hasCanonical?: boolean;
}

interface PagePerformanceResult {
  anomalies?: PageAnomaly[];
  metrics?: {
    lighthouse_score?: number | null;
    lcp_ms?: number | null;
    ttfb_ms?: number | null;
    cls?: number | null;
  };
}

interface AuditPage {
  id: string | number;
  url: string;
  seoResult?: PageSeoResult | null;
  performanceResult?: PagePerformanceResult | null;
}

interface SecurityResult {
  sslValid: boolean;
  sslExpiry?: string | null;
  sslIssuer?: string | null;
  sslDaysRemaining?: number | null;
  missingHeaders?: string[];
  presentHeaders?: string[];
  anomalies?: PageAnomaly[];
}

interface PriorityScore {
  level?: string;
  score?: number | null;
}

interface AuditPriorities {
  seo?: PriorityScore;
  performance?: PriorityScore;
  security?: PriorityScore;
  global?: PriorityScore;
}

interface RecommendationItem {
  title: string;
  description: string;
}

type Recommendations =
  | string
  | RecommendationItem[]
  | { text: string | RecommendationItem[] }
  | null;

interface Audit {
  id: string | number;
  url: string;
  status: string;
  globalScore: number | null;
  pages: AuditPage[];
  pagesCrawled: number;
  createdAt: string | null;
  completedAt: string | null;
  securityResult?: SecurityResult | null;
  priorities?: AuditPriorities | null;
  recommendations?: Recommendations;
}

function PageRow({
  page,
  type,
}: {
  page: AuditPage;
  type: "seo" | "performance";
}) {
  const [open, setOpen] = useState(false);
  const result = type === "seo" ? page.seoResult : page.performanceResult;
  if (!result) return null;
  const anomalies = result.anomalies || [];
  const map = type === "seo" ? SEO_TYPE_MAP : PERF_TYPE_MAP;
  const lhScore =
  type === "performance" && "metrics" in result
    ? result.metrics?.lighthouse_score ?? null
    : null;
  const lhColor = scoreColor(lhScore);

  return (
    <div className="rounded-xl overflow-auto" style={{ border: "1px solid #e5e7eb" }}>
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(o => !o)}>
        <div className="flex-1 min-w-0">
          <p className="truncate" style={{ fontSize: "13px", fontWeight: 500, color: "#374151" }}>
            {page.url.replace(/^https?:\/\/(www\.)?/, "")}
          </p>
        </div>
        {type === "performance" && lhScore !== null && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: lhColor + "20", color: lhColor }}>
            {lhScore}/100
          </span>
        )}
        {anomalies.length > 0 ? (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: "#fee2e2", color: "#dc2626" }}>
            {anomalies.length} anomalie{anomalies.length > 1 ? "s" : ""}
          </span>
        ) : (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: "#dcfce7", color: "#16a34a" }}>
            ✓ OK
          </span>
        )}
        {open ? <ChevronUp size={14} style={{ color: "#9ca3af", flexShrink: 0 }} />
               : <ChevronDown size={14} style={{ color: "#9ca3af", flexShrink: 0 }} />}
      </div>

      {open && (
        <div className="px-4 pb-4 pt-0" style={{ borderTop: "1px solid #f0fdf4", background: "#fafafa" }}>
          {type === "seo" && "h1Count" in result && (
  <div className="flex gap-4 py-3 mb-3">
    <div className="flex items-center gap-2">
      <span style={{ fontSize: "12px", color: "#9ca3af" }}>H1:</span>
      <span
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: (result.h1Count ?? 0) > 0 ? "#16a34a" : "#dc2626",
        }}
      >
        {result.h1Count ?? 0}
      </span>
    </div>
    <div className="flex items-center gap-2">
      <span style={{ fontSize: "12px", color: "#9ca3af" }}>Canonical:</span>
      <span
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: result.hasCanonical ? "#16a34a" : "#ca8a04",
        }}
      >
        {result.hasCanonical ? "Oui" : "Non"}
      </span>
    </div>
  </div>
)}
          {type === "performance" && "metrics" in result && result.metrics && (
            <div className="grid grid-cols-4 gap-3 py-3 mb-3">
              {[
                { label: "Lighthouse", value: result.metrics.lighthouse_score, unit: "/100" },
                { label: "LCP",  value: result.metrics.lcp_ms  ? `${(result.metrics.lcp_ms / 1000).toFixed(1)}s` : "—" },
                { label: "TTFB", value: result.metrics.ttfb_ms ? `${result.metrics.ttfb_ms}ms` : "—" },
                { label: "CLS",  value: result.metrics.cls != null ? result.metrics.cls.toFixed(3) : "—" },
              ].map(({ label, value, unit }) => (
                <div key={label} className="rounded-lg p-3 text-center" style={{ background: "white", border: "1px solid #e5e7eb" }}>
                  <p style={{ fontSize: "11px", color: "#9ca3af", marginBottom: "4px" }}>{label}</p>
                  <p style={{ fontSize: "15px", fontWeight: 700, color: "#14532d" }}>{value}{unit || ""}</p>
                </div>
              ))}
            </div>
          )}
          {anomalies.length > 0 ? (
            <div className="flex flex-col gap-2">
              {anomalies.map((a, i) => (
                <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-lg"
                  style={{ background: "white", border: "1px solid #e5e7eb" }}>
                  <AnomalyBadge type={a.type} map={map} />
                  <p style={{ fontSize: "12px", color: "#6b7280", lineHeight: 1.5 }}>{a.detail}</p>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: "12px", color: "#16a34a", padding: "8px 0" }}>✓ Aucune anomalie détectée</p>
          )}
        </div>
      )}
    </div>
  );
}

function renderRecsText(r: Recommendations): string {
  if (!r) return "";
  if (typeof r === "string") return r;

  const formatItems = (items: RecommendationItem[]) =>
    items
      .map((item) => `${item.title}\n${item.description}`)
      .join("\n\n");

  if (Array.isArray(r)) return formatItems(r);

  return typeof r.text === "string"
    ? r.text
    : formatItems(r.text);
}

function RecsDisplay({ text }: { text: string }) {
  return (
    <div style={{ fontSize: "14px", color: "#374151", lineHeight: 1.9 }}>
      {text.split("\n").map((line: string, i: number) => {
        const formatted = line.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
        if (formatted.startsWith("### ")) return <h3 key={i} style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "15px", color: "#14532d", marginTop: "20px", marginBottom: "8px" }}>{formatted.replace("### ", "")}</h3>;
        if (formatted.startsWith("#### ")) return <h4 key={i} style={{ fontWeight: 600, fontSize: "13px", color: "#374151", marginTop: "12px", marginBottom: "4px" }}>{formatted.replace("#### ", "")}</h4>;
        if (formatted.startsWith("---")) return <hr key={i} style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "12px 0" }} />;
        if (formatted.trim() === "") return <br key={i} />;
        return <p key={i} style={{ marginBottom: "6px" }}>{formatted}</p>;
      })}
    </div>
  );
}

export default function ReportPage() {
  const router = useRouter();
  const params = useParams();
  const jobId  = params?.id as string;

  const [audit, setAudit]             = useState<Audit | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [activeTab, setActiveTab]     = useState("overview");
  const [editingRecs, setEditingRecs] = useState(false);
  const [recsText, setRecsText]       = useState("");
  const [savingRecs, setSavingRecs]   = useState(false);
  const [exporting, setExporting]     = useState(false);

  useEffect(() => {
    if (!jobId) return;
    setLoading(true);
    getAudit(jobId)
      .then(data => { setAudit(data); setLoading(false); })
      .catch(() => { setError("Impossible de charger le rapport."); setLoading(false); });
  }, [jobId]);

  useEffect(() => {
    if (!audit) return;
    if (audit.status !== "done") return;
    if (audit.recommendations) return;
    const interval = setInterval(async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const res = await fetch(`${apiBase}/audit/${jobId}`);
        const data = await res.json();
        if (data.recommendations) { setAudit(data); clearInterval(interval); }
      } catch {}
    }, 10000);
    return () => clearInterval(interval);
  }, [audit, jobId]);

  // ── Export PDF ─────────────────────────────────────────────────────────────
const handleExportPdf = async () => {
  setExporting(true);
  try {
    // ✅ Add full backend URL
    const response = await fetch(`http://localhost:3001/audit/${jobId}/pdf`);
    
    if (!response.ok) {
      throw new Error('PDF generation failed');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pixiaudit-${getDomain(audit?.url || "report")}-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    setExporting(false);
  } catch (e) {
    console.error('PDF export error:', e);
    alert('Erreur lors de la génération du PDF');
    setExporting(false);
  }
};

  if (loading) return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex items-center gap-4 mb-6">
        <div className="w-9 h-9 rounded-xl animate-pulse" style={{ background: "#d1fae5" }} />
        <div>
          <div className="w-40 h-5 rounded-lg animate-pulse mb-2" style={{ background: "#d1fae5" }} />
          <div className="w-24 h-3 rounded-lg animate-pulse" style={{ background: "#e5e7eb" }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-5 mb-5">
        {[1,2].map(i => <div key={i} className="h-48 rounded-2xl animate-pulse" style={{ background: "#f0fdf4" }} />)}
      </div>
      <div className="h-64 rounded-2xl animate-pulse" style={{ background: "#f0fdf4" }} />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p style={{ fontSize: "15px", color: "#dc2626", marginBottom: "12px" }}>{error}</p>
      <button onClick={() => router.push("/dashboard/audits")}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
        style={{ background: "#dcfce7", color: "#16a34a" }}>
        <ArrowLeft size={14} /> Retour aux audits
      </button>
    </div>
  );

  if (!audit) return null;

  const domain      = getDomain(audit.url);
  const globalScore = audit.globalScore;
  const pages       = audit.pages || [];
  
  // ✅ FIXED: Single object, not array
  const security    = audit.securityResult || null;

  const seoPages = pages.filter((p) => p.seoResult);

const allSeoAnomalies = seoPages.flatMap(
  (p) => p.seoResult?.anomalies ?? []
);

const seoTypeCount = allSeoAnomalies.reduce(
  (acc: Record<string, number>, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  },
  {}
);

const perfPages = pages.filter(
  (p) => (p.performanceResult?.metrics?.lighthouse_score ?? 0) > 0
);

const avgLH = perfPages.length
  ? Math.round(
      perfPages.reduce(
        (sum, p) =>
          sum + (p.performanceResult?.metrics?.lighthouse_score ?? 0),
        0
      ) / perfPages.length
    )
  : null;

const allPerfAnomalies = pages.flatMap(
  (p) => p.performanceResult?.anomalies ?? []
);

const handleSaveRecs = async () => {
  setSavingRecs(true);
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    // ✅ Get token from your auth context/storage
    const token = localStorage.getItem('access_token'); // Or wherever you store it
    
    if (!token) {
      alert('❌ Vous devez être connecté pour modifier les recommandations');
      setSavingRecs(false);
      return;
    }
    
    const response = await fetch(`${apiUrl}/audit/${jobId}/recommendations`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`, // ✅ Add token
      },
      body: JSON.stringify({
        recommendations: recsText,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        alert('❌ Session expirée. Veuillez vous reconnecter.');
        // Redirect to login or refresh token
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    
    setAudit((prev) =>
      prev ? { ...prev, recommendations: recsText } : prev
    );
    
    setEditingRecs(false);
    alert(`✅ Sauvegardé (Version ${result.version})`);
    
  } catch (error: unknown) {
    console.error('Error:', error);

    const message =
      error instanceof Error ? error.message : "Erreur inconnue";

  alert(`❌ Erreur: ${message}`);
  } finally {
    setSavingRecs(false);
  }
};

  return (
    <div className="w-full min-h-screen bg-white">
    <div
      className="w-full max-w-7xl mx-auto px-6 pt-8 pb-12 md:px-8 md:pt-12 md:pb-16"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push("/dashboard/audits")}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-green-50"
          style={{ border: "1px solid #d1fae5" }}>
          <ArrowLeft size={16} style={{ color: "#16a34a" }} />
        </button>
        <div className="flex-1">
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "20px", fontWeight: 800, color: "#14532d" }}>
            {domain}
          </h2>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{
            background: audit.status === "done" ? "#dcfce7" : audit.status === "in_progress" ? "#dbeafe" : "#fee2e2",
            color:      audit.status === "done" ? "#16a34a" : audit.status === "in_progress" ? "#2563eb" : "#dc2626",
          }}>
          {audit.status === "done"        ? <CheckCircle2 size={13} /> :
           audit.status === "in_progress" ? <RefreshCw size={13} className="animate-spin" /> :
                                            <XCircle size={13} />}
          {audit.status === "done" ? "Terminé" : audit.status === "in_progress" ? "En cours" : "Échoué"}
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 rounded-xl mb-6 bg-white"
        style={{ border: "1px solid #d1fae5", width: "fit-content" }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: activeTab === id ? "#16a34a" : "transparent", color: activeTab === id ? "white" : "#6b7280" }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <div id="report-to-export">

        {/* TAB: Vue globale */}
        {activeTab === "overview" && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-5">
              <div className="rounded-2xl p-6 bg-white flex flex-col items-center justify-center"
                style={{ border: "1px solid #d1fae5" }}>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#6b7280", marginBottom: "16px" }}>Score global</p>
                <ScoreRing score={globalScore} />
                <p style={{ fontSize: "13px", color: "#9ca3af", marginTop: "8px" }}>sur 100</p>
              </div>
              <div className="rounded-2xl p-6 bg-white" style={{ border: "1px solid #d1fae5" }}>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#6b7280", marginBottom: "16px" }}>Informations</p>
                <div className="flex flex-col gap-3">
                  {[
                    { label: "URL",           value: audit.url },
                    { label: "Pages crawled", value: `${audit.pagesCrawled} pages` },
                    { label: "Statut",        value: audit.status },
                    { label: "Début",         value: formatLocalDateTime(audit.createdAt) },
                    { label: "Fin",           value: formatLocalDateTime(audit.completedAt) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-start gap-2">
                      <span style={{ fontSize: "12px", color: "#9ca3af", minWidth: "100px", flexShrink: 0 }}>{label}</span>
                      <span style={{ fontSize: "12px", fontWeight: 500, color: "#374151", wordBreak: "break-all" }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ✅ NEW: Priority Cards Section */}
            {audit.priorities && (
              <div className="rounded-2xl overflow-auto bg-white" style={{ border: "1px solid #d1fae5" }}>
                <div className="px-6 py-4 border-b flex items-center gap-2" style={{ borderColor: "#f0fdf4" }}>
                  <TrendingUp size={16} style={{ color: "#16a34a" }} />
                  <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "15px", color: "#14532d" }}>
                    Niveaux de priorité
                  </h3>
                </div>
                <div className="p-4 grid grid-cols-4 gap-3">
                  {[
                    { label: "SEO", data: audit.priorities.seo },
                    { label: "Performance", data: audit.priorities.performance },
                    { label: "Security", data: audit.priorities.security },
                    { label: "Global", data: audit.priorities.global },
                  ].map(({ label, data }) => {
                    const style = getPriorityColor(data?.level || "");
                    return (
                      <div key={label} className="rounded-xl p-4 flex flex-col items-center text-center"
                        style={{ background: style.bg, border: `1px solid ${style.color}40` }}>
                        <p style={{ fontSize: "11px", color: "#6b7280", marginBottom: "8px", fontWeight: 500 }}>{label}</p>
                        <div className="flex items-center gap-2 mb-2">
                          <span style={{ fontSize: "20px" }}>{style.emoji}</span>
                          <span style={{ fontSize: "24px", fontWeight: 800, color: style.color }}>{data?.score ?? "—"}</span>
                        </div>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ background: "white", color: style.color }}>
                          {data?.level || "N/A"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Pages analysées", value: audit.pagesCrawled,     color: "#16a34a", bg: "#dcfce7", icon: Globe },
                { label: "Anomalies SEO",   value: allSeoAnomalies.length, color: "#ca8a04", bg: "#fef9c3", icon: AlertTriangle },
                { label: "Check sécurité",  value: security ? 1 : 0,       color: "#6366f1", bg: "#ede9fe", icon: ShieldCheck },
              ].map(({ label, value, color, bg, icon: Icon }) => (
                <div key={label} className="rounded-2xl p-5 bg-white flex items-center gap-4"
                  style={{ border: "1px solid #d1fae5" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                    <Icon size={18} style={{ color }} />
                  </div>
                  <div>
                    <p style={{ fontSize: "22px", fontWeight: 800, fontFamily: "'Syne', sans-serif", color: "#14532d", lineHeight: 1 }}>{value}</p>
                    <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ✅ FIXED: Single security object */}
            {security && (
              <div className="rounded-2xl overflow-auto bg-white" style={{ border: "1px solid #d1fae5" }}>
                <div className="px-6 py-4 border-b" style={{ borderColor: "#f0fdf4" }}>
                  <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "15px", color: "#14532d" }}>Résultats Sécurité</h3>
                </div>
                <div className="p-4">
                  <div className="rounded-xl p-4" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: security.sslValid ? "#dcfce7" : "#fee2e2", color: security.sslValid ? "#16a34a" : "#dc2626" }}>
                        SSL: {security.sslValid ? "Valide" : "Invalide"}
                      </span>
                      {security.sslExpiry && <span style={{ fontSize: "12px", color: "#6b7280" }}>Expire: {security.sslExpiry}</span>}
                      {security.sslIssuer && <span style={{ fontSize: "12px", color: "#6b7280" }}>Émetteur: {security.sslIssuer}</span>}
                      {security.sslDaysRemaining != null && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: security.sslDaysRemaining < 30 ? "#fef9c3" : "#dcfce7", color: security.sslDaysRemaining < 30 ? "#ca8a04" : "#16a34a" }}>
                          {security.sslDaysRemaining}j restants
                        </span>
                      )}
                    </div>
                    {(security.missingHeaders?.length ?? 0) > 0 && (
                      <div>
                        <p style={{ fontSize: "12px", color: "#ca8a04", fontWeight: 500, marginBottom: "4px" }}>Headers manquants:</p>
                        <div className="flex flex-wrap gap-1">
                          {(security.missingHeaders ?? []).map((h: string) => (
                            <span key={h} className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: "#fef9c3", color: "#ca8a04" }}>{h}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {audit.status !== "done" && (
              <div className="rounded-2xl p-8 bg-white flex flex-col items-center justify-center text-center"
                style={{ border: "1px solid #d1fae5" }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#dcfce7" }}>
                  <Clock size={22} style={{ color: "#16a34a" }} />
                </div>
                <p style={{ fontSize: "15px", fontWeight: 600, color: "#14532d", marginBottom: "6px" }}>
                  Audit {audit.status === "in_progress" ? "en cours" : "échoué"}
                </p>
                <p style={{ fontSize: "13px", color: "#9ca3af" }}>
                  {audit.status === "in_progress"
                    ? "Les résultats seront disponibles une fois l'audit terminé."
                    : "Une erreur est survenue lors de l'audit."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB: SEO */}
        {activeTab === "seo" && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Pages analysées", value: seoPages.length,        color: "#16a34a", bg: "#dcfce7" },
                { label: "Total anomalies", value: allSeoAnomalies.length, color: "#dc2626", bg: "#fee2e2" },
                { label: "Pages sans H1",   value: seoPages.filter((p) => p.seoResult?.h1Count === 0).length, color: "#ca8a04", bg: "#fef9c3" },
              ].map(({ label, value, color}) => (
                <div key={label} className="rounded-2xl p-5 bg-white flex items-center gap-4"
                  style={{ border: "1px solid #d1fae5" }}>
                  <div>
                    <p style={{ fontSize: "26px", fontWeight: 800, fontFamily: "'Syne', sans-serif", color, lineHeight: 1 }}>{value}</p>
                    <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {Object.keys(seoTypeCount).length > 0 && (
              <div className="rounded-2xl bg-white overflow-auto" style={{ border: "1px solid #d1fae5" }}>
                <div className="px-6 py-4 border-b" style={{ borderColor: "#f0fdf4" }}>
                  <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "15px", color: "#14532d" }}>
                    Anomalies les plus fréquentes
                  </h3>
                </div>
                <div className="p-4 flex flex-col gap-2">
                  {Object.entries(seoTypeCount)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([type, count]) => {
                      const def = SEO_TYPE_MAP[type] || { label: type, severity: "info" as const };
                      const style = SEVERITY_STYLE[def.severity];
                      const pct = Math.round(((count as number) / seoPages.length) * 100);
                      return (
                        <div key={type} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                          style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                            style={{ background: style.bg, color: style.color }}>
                            {style.icon} {def.label}
                          </span>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span style={{ fontSize: "12px", color: "#6b7280" }}>{count as number} page{(count as number) > 1 ? "s" : ""}</span>
                              <span style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>{pct}%</span>
                            </div>
                            <div className="rounded-full overflow-auto" style={{ height: "4px", background: "#e5e7eb" }}>
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: style.color }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-white overflow-auto" style={{ border: "1px solid #d1fae5" }}>
              <div className="px-6 py-4 border-b" style={{ borderColor: "#f0fdf4" }}>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "15px", color: "#14532d" }}>Détail par page</h3>
              </div>
              <div className="p-4 flex flex-col gap-2">
                {seoPages.map((p) => <PageRow key={p.id} page={p} type="seo" />)}
              </div>
            </div>
          </div>
        )}

        {/* TAB: Performance */}
        {activeTab === "performance" && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Score Lighthouse moy.", value: avgLH !== null ? `${avgLH}/100` : "—", color: scoreColor(avgLH), bg: scoreColor(avgLH) + "20" },
                { label: "Pages analysées",       value: perfPages.length,        color: "#16a34a", bg: "#dcfce7" },
                { label: "Total anomalies perf.", value: allPerfAnomalies.length, color: "#dc2626", bg: "#fee2e2" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-2xl p-5 bg-white flex items-center gap-4"
                  style={{ border: "1px solid #d1fae5" }}>
                  <div>
                    <p style={{ fontSize: "26px", fontWeight: 800, fontFamily: "'Syne', sans-serif", color, lineHeight: 1 }}>{value}</p>
                    <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>{label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-white overflow-auto" style={{ border: "1px solid #d1fae5" }}>
              <div className="px-6 py-4 border-b" style={{ borderColor: "#f0fdf4" }}>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "15px", color: "#14532d" }}>Détail par page</h3>
              </div>
              <div className="p-4 flex flex-col gap-2">
                {pages
                  .filter((p) => p.performanceResult)
                  .sort(
                    (a,b) =>
                    (a.performanceResult?.metrics?.lighthouse_score ?? 0) -
                    (b.performanceResult?.metrics?.lighthouse_score ?? 0)
                  )
                  .map((p) => (
                  <PageRow key={p.id} page={p} type="performance" />)
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: Sécurité */}
        {activeTab === "security" && (
          <div className="flex flex-col gap-5">
            {!security ? (
              <div className="rounded-2xl p-8 bg-white flex flex-col items-center justify-center text-center"
                style={{ border: "1px solid #d1fae5" }}>
                <p style={{ fontSize: "15px", color: "#9ca3af" }}>Aucun résultat de sécurité disponible.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="rounded-2xl bg-white overflow-auto" style={{ border: "1px solid #d1fae5" }}>
                  <div className="px-6 py-4 border-b flex items-center gap-2" style={{ borderColor: "#f0fdf4" }}>
                    <ShieldCheck size={16} style={{ color: "#16a34a" }} />
                    <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "15px", color: "#14532d" }}>Certificat SSL</h3>
                  </div>
                  <div className="p-6 grid grid-cols-2 gap-4">
                    {[
                      { label: "Statut",        value: security.sslValid ? "✓ Valide" : "✗ Invalide", color: security.sslValid ? "#16a34a" : "#dc2626" },
                      { label: "Émetteur",       value: security.sslIssuer || "—",                     color: "#374151" },
                      { label: "Expiration", value: security.sslExpiry || "—", color: security.sslDaysRemaining != null && security.sslDaysRemaining < 30 ? "#ca8a04" : "#374151" },
                      { label: "Jours restants", value: security.sslDaysRemaining != null ? `${security.sslDaysRemaining} jours` : "—", color: security.sslDaysRemaining != null && security.sslDaysRemaining < 30 ? "#ca8a04" : "#16a34a" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="rounded-xl p-4" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                        <p style={{ fontSize: "11px", color: "#9ca3af", marginBottom: "4px" }}>{label}</p>
                        <p style={{ fontSize: "14px", fontWeight: 600, color }}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-white overflow-auto" style={{ border: "1px solid #d1fae5" }}>
                  <div className="px-6 py-4 border-b" style={{ borderColor: "#f0fdf4" }}>
                    <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "15px", color: "#14532d" }}>Headers de sécurité</h3>
                  </div>
                  <div className="p-6 flex flex-col gap-3">
                    {(security.missingHeaders?.length ?? 0) > 0 && (
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: 600, color: "#dc2626", marginBottom: "8px" }}>
                          ✗ Headers manquants ({security.missingHeaders?.length ?? 0})
                        </p>
                        <div className="flex flex-col gap-2">
                          {(security.missingHeaders ?? []).map((h: string) => (
                            <div key={h} className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                              style={{ background: "#fee2e2", border: "1px solid #fecaca" }}>
                              <XCircle size={14} style={{ color: "#dc2626", flexShrink: 0 }} />
                              <span style={{ fontSize: "13px", fontWeight: 500, color: "#dc2626", fontFamily: "monospace" }}>{h}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {(security.presentHeaders?.length ?? 0) > 0 && (
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: 600, color: "#16a34a", marginBottom: "8px" }}>
                          ✓ Headers présents ({security.presentHeaders?.length ?? 0})
                        </p>
                        <div className="flex flex-col gap-2">
                          {(security.presentHeaders ?? []).map((h: string) => (
                            <div key={h} className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                              style={{ background: "#dcfce7", border: "1px solid #bbf7d0" }}>
                              <CheckCircle2 size={14} style={{ color: "#16a34a", flexShrink: 0 }} />
                              <span style={{ fontSize: "13px", fontWeight: 500, color: "#16a34a", fontFamily: "monospace" }}>{h}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {(security.anomalies?.length ?? 0) > 0 && (
                  <div className="rounded-2xl bg-white overflow-auto" style={{ border: "1px solid #d1fae5" }}>
                    <div className="px-6 py-4 border-b" style={{ borderColor: "#f0fdf4" }}>
                      <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "15px", color: "#14532d" }}>
                        Anomalies détectées ({security.anomalies?.length ?? 0})
                      </h3>
                    </div>
                    <div className="p-4 flex flex-col gap-2">
                      {(security.anomalies ?? []).map((a, i) => (
                        <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl"
                          style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                          <AnomalyBadge type={a.type} map={SEC_TYPE_MAP} />
                          <p style={{ fontSize: "12px", color: "#6b7280", lineHeight: 1.5 }}>{a.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB: Recommandations IA */}
        {activeTab === "recommendations" && (
          <div className="flex flex-col gap-5">
            {audit.recommendations ? (
              <div id="recommendations-content" className="rounded-2xl overflow-auto bg-white" style={{ border: "1px solid #d1fae5" }}>

                {/* Card header */}
                <div className="px-6 py-4 border-b" style={{ borderColor: "#f0fdf4" }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: "16px" }}>🤖</span>
                      <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "15px", color: "#14532d" }}>
                        Recommandations IA
                      </h3>
                    </div>

                    {/* Buttons — hidden during export */}
                    {!exporting && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleExportPdf}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                          style={{ background: "linear-gradient(135deg,#79C300,#00968F)", color: "white" }}>
                          <Download size={13} />Exporter PDF
                        </button>
                        {!editingRecs ? (
                          <button
                            onClick={() => {
  if (!audit.recommendations) return;
  setRecsText(renderRecsText(audit.recommendations));
  setEditingRecs(true);
}}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                            style={{ background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" }}>
                            ✏️ Modifier
                          </button>
                        ) : (
                          <>
                            <button onClick={() => setEditingRecs(false)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                              style={{ background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" }}>
                              Annuler
                            </button>
                            <button onClick={handleSaveRecs} disabled={savingRecs}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80 disabled:opacity-50"
                              style={{ background: "#dcfce7", color: "#16a34a", border: "1px solid #bbf7d0" }}>
                              {savingRecs ? "Sauvegarde..." : "✅ Valider"}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  {editingRecs ? (
                    <textarea value={recsText} onChange={e => setRecsText(e.target.value)} rows={20}
                      className="w-full outline-none resize-none rounded-xl p-4"
                      style={{ fontSize: "14px", color: "#374151", lineHeight: 1.9, border: "1px solid #d1fae5", background: "#f9fafb" }} />
                  ) : (
                    <RecsDisplay text={renderRecsText(audit.recommendations)} />
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl p-8 bg-white flex flex-col items-center justify-center text-center"
                style={{ border: "1px solid #d1fae5" }}>
                <span style={{ fontSize: "40px", marginBottom: "16px" }}>🤖</span>
                <p style={{ fontSize: "15px", fontWeight: 600, color: "#14532d", marginBottom: "6px" }}>
                  Recommandations IA en cours de génération
                </p>
                <p style={{ fontSize: "13px", color: "#9ca3af" }}>
                  L analyse IA est en cours, veuillez patienter quelques minutes. La page se mettra à jour automatiquement.
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
    </div>
  );
}