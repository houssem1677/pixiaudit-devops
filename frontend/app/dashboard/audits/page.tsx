// ============================================
// PAGE : Liste des Audits — Mes Audits
// ROUTE: /dashboard/audits
// ============================================
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Plus, CheckCircle2, Activity, XCircle,
  Clock, ArrowRight, Calendar, RefreshCw, X, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { getAudits, cancelAudit, deleteAudit } from "@/lib/api";

const FILTERS = ["Tous", "done", "in_progress", "failed"];
const FILTER_LABELS: Record<string, string> = {
  "Tous": "Tous",
  "done": "Terminé",
  "in_progress": "En cours",
  "failed": "Échoué",
};

interface Audit {
  id: string | number;
  jobId: string;
  url: string;
  status: string;
  createdAt: string | null;
  pagesCrawled: number;
  globalScore: number | null;
}

function ScoreRing({ score }: { score: number | null }) {
  if (!score) return <div style={{ width: 46 }} />;
  const r = 18, circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 70 ? "#16a34a" : score >= 50 ? "#ca8a04" : "#dc2626";
  return (
    <svg width="46" height="46" viewBox="0 0 46 46">
      <circle cx="23" cy="23" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3" />
      <circle cx="23" cy="23" r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 23 23)" />
      <text x="23" y="27" textAnchor="middle" fill={color} fontSize="10" fontWeight="700">{score}</text>
    </svg>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    done:        { label: "Terminé",    color: "#16a34a", bg: "#dcfce7", icon: <CheckCircle2 size={11} /> },
    in_progress: { label: "En cours",   color: "#2563eb", bg: "#dbeafe", icon: <Activity size={11} /> },
    failed:      { label: "Échoué",     color: "#dc2626", bg: "#fee2e2", icon: <XCircle size={11} /> },
    pending:     { label: "En attente", color: "#ca8a04", bg: "#fef9c3", icon: <Clock size={11} /> },
  };
  const s = map[status] || map.pending;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: s.bg, color: s.color }}>
      {s.icon} {s.label}
    </span>
  );
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const day   = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year  = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function getDomain(url: string) {
  try { return new URL(url).hostname.replace("www.", ""); }
  catch { return url; }
}

export default function MesAuditsPage() {
  const router = useRouter();
  const [audits, setAudits]         = useState<Audit[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [search, setSearch]         = useState("");
  const [filter, setFilter]         = useState("Tous");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [deleting, setDeleting]     = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Authentication check
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.replace("/login");
    } else {
      setIsAuthorized(true);
    }
  }, [router]);

  const fetchAudits = async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const data = await getAudits();
      setAudits(Array.isArray(data) ? data : []);
    } catch {
      setError("Impossible de charger les audits.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchAudits();
    }
  }, [isAuthorized]);

  useEffect(() => {
    if (!isAuthorized) return;
    const hasInProgress = audits.some(a => a.status === 'in_progress');
    if (!hasInProgress) return;
    const interval = setInterval(() => { fetchAudits(true); }, 5000);
    return () => clearInterval(interval);
  }, [audits, isAuthorized]);

  const handleCancel = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    setCancelling(jobId);
    try {
      await cancelAudit(jobId);
      await fetchAudits();
    } catch (err) {
      console.error(err);
    } finally {
      setCancelling(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    if (!confirm("Voulez-vous vraiment supprimer cet audit ? Cette action est irréversible.")) {
      return;
    }
    setDeleting(jobId);
    try {
      await deleteAudit(jobId);
      setAudits(prev => prev.filter(a => a.jobId !== jobId));
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la suppression");
    } finally {
      setDeleting(null);
    }
  };

  const filtered = audits.filter(a => {
    const domain = getDomain(a.url);
    const matchSearch = domain.toLowerCase().includes(search.toLowerCase()) || a.jobId?.includes(search);
    const matchFilter = filter === "Tous" || a.status === filter;
    return matchSearch && matchFilter;
  });

  // Show loading while checking authentication
  if (!isAuthorized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-[#79C300] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Vérification...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-white">
      <div className="w-full max-w-7xl mx-auto px-6 pt-8 pb-12 md:px-8 md:pt-12 md:pb-16">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Mes Audits</h1>
          <p className="text-sm md:text-base text-gray-500">
            {audits.length} audit{audits.length > 1 ? "s" : ""} au total
          </p>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un domaine ou job ID..."
              className="pl-9 h-11 rounded-lg border-gray-200 focus:border-[#79C300] focus:ring-[#79C300]"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => fetchAudits()}
              className="w-11 h-11 rounded-lg border-gray-200 hover:bg-gray-50"
            >
              <RefreshCw size={16} className="text-gray-600" />
            </Button>
            <Button
              onClick={() => router.push("/dashboard/new")}
              className="h-11 bg-[#79C300] text-white rounded-lg font-medium shadow-sm hover:bg-[#6aad00] transition-colors px-4"
            >
              <Plus size={16} className="mr-2" /> Nouvel audit
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-gray-100 w-fit">
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  filter === f 
                    ? "bg-[#79C300] text-white shadow-sm" 
                    : "text-gray-600 hover:bg-gray-200"
                }`}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Audits Table */}
        <Card className="border-0 shadow-sm overflow-hidden">
          {/* Table Header - largeur augmentée pour les actions */}
          <div className="hidden md:grid px-6 py-3 border-b border-gray-200 bg-gray-50"
            style={{ gridTemplateColumns: "1fr 130px 110px 100px 52px 80px" }}>
            {["Domaine", "Statut", "Date", "Pages", "Score", "Actions"].map(h => (
              <span key={h} className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</span>
            ))}
          </div>

          {/* Loading State */}
          {loading ? (
            <CardContent className="p-6">
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-14 rounded-lg animate-pulse bg-gray-100" />
                ))}
              </div>
            </CardContent>
          ) : error ? (
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-red-600 mb-2">{error}</p>
              <Button variant="link" onClick={() => fetchAudits()} className="text-[#79C300]">
                Réessayer
              </Button>
            </CardContent>
          ) : filtered.length === 0 ? (
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-gray-100">
                <Search size={20} className="text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                {audits.length === 0 ? "Aucun audit pour le moment" : "Aucun résultat"}
              </p>
              <p className="text-sm text-gray-500">
                {audits.length === 0 ? "Lancez votre premier audit." : "Essayez un autre terme."}
              </p>
            </CardContent>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map(a => {
                const domain = getDomain(a.url);
                return (
                  <div
                    key={a.id}
                    className="grid grid-cols-1 md:grid-cols-[1fr_130px_110px_100px_52px_80px] items-center px-6 py-4 cursor-pointer group transition-colors hover:bg-gray-50"
                    onClick={() => a.status === "done" && router.push(`/dashboard/audits/${a.jobId}/report`)}
                  >
                    {/* Domain */}
                    <div className="flex items-center gap-3 mb-3 md:mb-0">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0 bg-gradient-to-br from-[#79C300] to-[#00968F]">
                        {domain[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{domain}</p>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="mb-2 md:mb-0"><StatusBadge status={a.status} /></div>

                    {/* Date */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2 md:mb-0">
                      <Calendar size={12} className="text-gray-400" />
                      {formatDate(a.createdAt)}
                    </div>

                    {/* Pages */}
                    <div className="text-xs text-gray-500 mb-2 md:mb-0">
                      {a.pagesCrawled > 0 ? `${a.pagesCrawled} pages` : "—"}
                    </div>

                    {/* Score */}
                    <div className="mb-2 md:mb-0"><ScoreRing score={a.globalScore} /></div>

                    {/* Actions */}
                    <div className="flex items-center justify-start md:justify-center gap-2">
                      {a.status === "in_progress" && (
                        <button
                          onClick={(e) => handleCancel(e, a.jobId)}
                          disabled={cancelling === a.jobId}
                          className="w-8 h-8 rounded-lg border border-red-200 hover:bg-red-50 disabled:opacity-50 flex items-center justify-center transition-colors"
                          title="Annuler l'audit"
                        >
                          {cancelling === a.jobId
                            ? <div className="w-3 h-3 rounded-full border border-red-300 border-t-red-600 animate-spin" />
                            : <X size={14} className="text-red-600" />
                          }
                        </button>
                      )}
                      <button
                        onClick={(e) => handleDelete(e, a.jobId)}
                        disabled={deleting === a.jobId}
                        className="w-8 h-8 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center transition-colors"
                        title="Supprimer l'audit"
                      >
                        {deleting === a.jobId
                          ? <div className="w-3 h-3 rounded-full border border-gray-400 border-t-gray-700 animate-spin" />
                          : <Trash2 size={14} className="text-gray-500 hover:text-red-600" />
                        }
                      </button>
                      {a.status === "done" && (
                        <ArrowRight size={16}
                          className="text-[#79C300] opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}