// ============================================
// PAGE : Nouvel Audit — Formulaire création
// ROUTE: /dashboard/new
// ============================================
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Loader2,
  Globe,
  AlertCircle,
  ChevronRight,
  Search,
  Settings,
  ChevronDown,
  Zap,
  ShieldCheck
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

/* ─────────────────────────────────────────────── */
/* CMS TYPES */
/* ─────────────────────────────────────────────── */

type CMS =
  | "WordPress"
  | "Joomla"
  | "Drupal"
  | "Shopify"
  | "Magento"
  | "PrestaShop"
  | "Wix"
  | "Squarespace"
  | "Webflow"
  | "Ghost"
  | "TYPO3"
  | "OpenCart"
  | "WooCommerce"
  | "Blogger"
  | "HubSpot"
  | "Notion"
  | "Contentful"
  | "Adobe AEM"
  | "Sitecore"
  | "October CMS"
  | "Autre"
  | "";

const CMS_LIST: CMS[] = [
  "WordPress",
  "Joomla",
  "Drupal",
  "Shopify",
  "Magento",
  "PrestaShop",
  "Wix",
  "Squarespace",
  "Webflow",
  "Ghost",
  "TYPO3",
  "OpenCart",
  "WooCommerce",
  "Blogger",
  "HubSpot",
  "Notion",
  "Contentful",
  "Adobe AEM",
  "Sitecore",
  "October CMS",
  "Autre",
];

/* ─────────────────────────────────────────────── */
/* CUSTOM COMPONENTS */
/* ─────────────────────────────────────────────── */

// Toggle component
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`
        relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full
        transition-colors duration-200 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-[#79C300] focus:ring-offset-2
        ${value ? "bg-[#79C300]" : "bg-gray-200"}
      `}
    >
      <span
        className={`
          inline-block h-5 w-5 transform rounded-full bg-white shadow-md
          transition-transform duration-200 ease-in-out
          ${value ? "translate-x-5" : "translate-x-0.5"}
          mt-[2px]
        `}
      />
    </button>
  );
}

// Checkbox component
function Checkbox({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-2 text-sm ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-gray-300 text-[#79C300] focus:ring-[#79C300] focus:ring-offset-0 disabled:opacity-50"
      />
      <span className="text-gray-700">{label}</span>
    </label>
  );
}

// Number input with label
function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled = false
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-gray-500 font-normal">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="h-9 text-sm"
      />
    </div>
  );
}

// Field wrapper for crawl settings
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────── */
/* STEP BAR */
/* ─────────────────────────────────────────────── */

function StepBar({ current }: { current: number }) {
  const steps = ["URL & CMS", "Analyses", "Configuration", "Récapitulatif"];

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between gap-2">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;

          return (
            <div key={i} className="flex-1">
              <div className="flex items-center">
                <div
                  className={`
                    relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all
                    ${done || active
                      ? "bg-[#79C300] text-white shadow-md"
                      : "bg-gray-100 text-gray-400 border border-gray-200"
                    }
                  `}
                >
                  {done ? <Check size={14} /> : i + 1}
                </div>

                <span
                  className={`
                    hidden md:inline-block ml-2 text-sm font-medium transition-all whitespace-nowrap
                    ${active ? "text-[#79C300]" : done ? "text-gray-700" : "text-gray-400"}
                  `}
                >
                  {label}
                </span>

                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${i < current ? "bg-[#79C300]" : "bg-gray-200"}`} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between mt-2 md:hidden">
        {steps.map((label, i) => (
          <span key={i} className={`text-xs ${current === i ? "text-[#79C300] font-medium" : "text-gray-400"}`}>
            {label.split(' ')[0]}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────── */
/* MAIN PAGE COMPONENT */
/* ─────────────────────────────────────────────── */

export default function NewAuditPage() {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [cms, setCms] = useState<CMS>("");
  const [detecting, setDetecting] = useState(false);
  const [launchError, setLaunchError] = useState("");
  const [launching, setLaunching] = useState(false);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const [audits, setAudits] = useState({
    seo: true,
    performance: true,
    security: true,
  });

  const [expandedConfig, setExpandedConfig] = useState({
    seo: false,
    performance: false,
    security: false,
  });

  const [secConfig, setSecConfig] = useState({
    check_ssl: true,
    check_headers: true,
    ssl_days_warning: 30,
    header_hsts: true,
    header_csp: true,
    header_xframe: true,
    header_xcontent: true,
  });

  const [seoConfig, setSeoConfig] = useState({
    check_h1: true,
    check_meta_description: true,
    check_title_length: true,
    check_canonical: true,
    title_min_length: 30,
    title_max_length: 60,
    meta_desc_min_length: 120,
    meta_desc_max_length: 160,
  });

  const [perfConfig, setPerfConfig] = useState({
    lighthouse_concurrency: 3,
    ttfb_ms: 600,
    lcp_ms: 2500,
    cls: 0.1,
    score_min: 0.8,
    strategy: "mobile" as "mobile" | "desktop",
  });

  const [maxPages, setMaxPages] = useState(100);
  const [maxDepth, setMaxDepth] = useState(3);
  const [concurrency, setConcurrency] = useState(5);
  const [delayMs, setDelayMs] = useState(500);
  const [respectRobots, setRespectRobots] = useState(true);
  const [hasAuth, setHasAuth] = useState(false);
  const [authLoginUrl, setAuthLoginUrl] = useState("");
  const [authUser, setAuthUser] = useState("");
  const [authPass, setAuthPass] = useState("");

  const selectedCount = [audits.seo, audits.performance, audits.security].filter(Boolean).length;

  // Helper function to get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem("access_token");
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  const validateUrl = (v: string) => {
    if (!v) return "URL obligatoire";
    try {
      new URL(v);
      return "";
    } catch {
      return "URL invalide (ex: https://exemple.com)";
    }
  };

  // Updated CMS detection with API call and authentication
  useEffect(() => {
    if (!url) { setCms(""); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    debounceRef.current = setTimeout(async () => {
      if (validateUrl(url)) return;
      setDetecting(true);
      setCms("");
      
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const token = localStorage.getItem("access_token");
        
        const res = await fetch(`${apiBase}/audit/detect-cms?url=${encodeURIComponent(url)}`, { 
          signal: AbortSignal.timeout(6000),
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        
        if (res.ok) {
          const data = await res.json();
          const CMS_VALID = ["WordPress", "Joomla", "Drupal", "Shopify", "Magento", "Autre", "PrestaShop", "Wix", "Squarespace", "Webflow", "Ghost", "TYPO3", "OpenCart", "WooCommerce", "Blogger", "HubSpot", "Notion", "Contentful", "Adobe AEM", "Sitecore", "October CMS"];
          if (data.cms && CMS_VALID.includes(data.cms)) { 
            setCms(data.cms); 
            setDetecting(false); 
            return; 
          }
        }
      } catch {}
      
      const lower = url.toLowerCase();
      if (/myshopify\.com/.test(lower)) setCms("Shopify");
      else if (/\/wp-content\/|\/wp-includes\/|wp-json/.test(lower)) setCms("WordPress");
      else if (/joomla/.test(lower)) setCms("Joomla");
      else if (/drupal/.test(lower)) setCms("Drupal");
      else if (/magento/.test(lower)) setCms("Magento");
      else if (/prestashop/.test(lower)) setCms("PrestaShop");
      else if (/wix/.test(lower)) setCms("Wix");
      else if (/webflow/.test(lower)) setCms("Webflow");
      else setCms("");
      setDetecting(false);
    }, 900);
    
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [url]);

  const toggleConfig = (key: keyof typeof expandedConfig) => {
    setExpandedConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleNext = () => {
    if (step === 0) {
      const err = validateUrl(url);
      if (err) {
        setUrlError(err);
        return;
      }
    }
    setStep((s) => Math.min(s + 1, 3));
  };

  const handleBack = () => {
    setStep((s) => Math.max(s - 1, 0));
  };

  // Updated handleLaunch with authentication token
  const handleLaunch = async () => {
    setLaunching(true);
    setLaunchError("");

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

      const res = await fetch(`${apiBase}/audit`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          url,
          cms: cms || null,
          config: {
            audits: {
              seo: audits.seo,
              performance: audits.performance,
              security: audits.security,
            },
            crawler: {
              max_pages: maxPages,
              timeout_sec: 10,
              delay_ms: delayMs,
              respect_robots_txt: respectRobots,
              max_depth: maxDepth,
              concurrency: concurrency,
              auth: {
                enabled: hasAuth,
                login_url: authLoginUrl,
                username: authUser,
                password: authPass,
                username_field: "username",
                password_field: "password",
              },
            },
            seo: {
              title_min_length: seoConfig.title_min_length,
              title_max_length: seoConfig.title_max_length,
              meta_desc_min_length: seoConfig.meta_desc_min_length,
              meta_desc_max_length: seoConfig.meta_desc_max_length,
              rules: {
                check_h1: seoConfig.check_h1,
                check_meta_description: seoConfig.check_meta_description,
                check_title_length: seoConfig.check_title_length,
                check_canonical: seoConfig.check_canonical,
              },
            },
            performance: {
              strategy: perfConfig.strategy,
              lighthouse_concurrency: perfConfig.lighthouse_concurrency,
              thresholds: {
                ttfb_ms: perfConfig.ttfb_ms,
                lcp_ms: perfConfig.lcp_ms,
                cls: perfConfig.cls,
                score_min: perfConfig.score_min,
              },
            },
            security: {
              check_ssl: secConfig.check_ssl,
              check_headers: secConfig.check_headers,
              ssl_days_warning: secConfig.ssl_days_warning,
              required_headers: [
                secConfig.header_hsts ? "Strict-Transport-Security" : null,
                secConfig.header_csp ? "Content-Security-Policy" : null,
                secConfig.header_xframe ? "X-Frame-Options" : null,
                secConfig.header_xcontent ? "X-Content-Type-Options" : null,
              ].filter(Boolean),
            },
          },
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Token expired or invalid
          localStorage.removeItem("access_token");
          localStorage.removeItem("user_name");
          localStorage.removeItem("user_role");
          router.push("/login");
          return;
        }
        const err = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(err.message || "Erreur serveur.");
      }

      // Redirect to audits page on success
      router.push("/dashboard/audits");

    } catch (e: unknown) {
      setLaunchError(
        e instanceof Error ? e.message : "Erreur inconnue."
      );
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-white">
      <div className="w-full px-6 pt-8 pb-12 md:px-8 md:pt-12 md:pb-16">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Nouvel audit</h1>
          <p className="text-sm md:text-base text-gray-500">Configurez et lancez l&apos;analyse de votre site</p>
        </div>

        <StepBar current={step} />

        {/* Step 0 : URL & CMS - Now without width constraint */}
        {step === 0 && (
          <div className="space-y-6">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6 space-y-6">
                <div>
                  <Label className="text-sm font-semibold text-gray-700 block mb-2">
                    URL du site <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Globe
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{
                        color: urlError
                          ? "#ef4444"
                          : url && !urlError && !detecting
                            ? "#79C300"
                            : "#9ca3af",
                      }}
                    />
                    <Input
                      type="url"
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        setUrlError("");
                      }}
                      onBlur={() => setUrlError(validateUrl(url))}
                      placeholder="https://exemple.com"
                      className={`pl-9 pr-10 h-11 text-sm ${urlError ? "border-red-500 focus:ring-red-500" : ""}`}
                    />
                    {url && !urlError && !detecting && (
                      <Check size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#79C300]" />
                    )}
                    {detecting && (
                      <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#79C300]" />
                    )}
                  </div>
                  {urlError && (
                    <p className="flex items-center gap-1.5 mt-2 text-xs text-red-500">
                      <AlertCircle size={12} />
                      {urlError}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-sm font-semibold text-gray-700 block mb-2">
                    Type de CMS
                  </Label>
                  <div className="relative">
                    <select
                      value={cms}
                      onChange={(e) => setCms(e.target.value as CMS)}
                      className="w-full px-3 py-2 h-11 rounded-lg outline-none appearance-none border border-gray-200 bg-white text-gray-900 text-sm focus:ring-2 focus:ring-[#79C300] focus:border-transparent"
                    >
                      <option value="">
                        {detecting ? "Détection en cours..." : "Détection automatique"}
                      </option>
                      {CMS_LIST.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none rotate-90 text-gray-400" />
                  </div>
                  {detecting && (
                    <p className="flex items-center gap-1.5 mt-2 text-xs text-[#79C300]">
                      <Loader2 size={12} className="animate-spin" />
                      Analyse du CMS en cours...
                    </p>
                  )}
                  {!detecting && cms && (
                    <p className="flex items-center gap-1.5 mt-2 text-xs text-[#79C300]">
                      <Check size={12} />
                      CMS détecté : {cms}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-center">
  <button
    onClick={handleNext}
    className="h-11 w-full max-w-md bg-[#79C300] text-white rounded-lg font-medium shadow-sm cursor-pointer hover:bg-[#6aad00] transition-colors"
  >
    Continuer
  </button>
</div>
          </div>
        )}

        {/* Step 1 : Analyses */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {selectedCount} analyse{selectedCount > 1 ? "s" : ""} activée{selectedCount > 1 ? "s" : ""}
              </p>
            </div>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-gray-900">Analyses techniques</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* SEO Card */}
                <div className={`rounded-lg border transition-all ${audits.seo ? 'border-black bg-green-50/20' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Search className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-base font-medium text-gray-900">SEO technique</p>
                        <p className="text-xs text-gray-500 mt-0.5">Meta, H1, canonical, titre</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {audits.seo && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleConfig("seo")}
                          className="h-8 px-2"
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          <ChevronDown className={`h-4 w-4 transition-transform ${expandedConfig.seo ? "rotate-180" : ""}`} />
                        </Button>
                      )}
                      <Toggle value={audits.seo} onChange={(v) => setAudits((a) => ({ ...a, seo: v }))} />
                    </div>
                  </div>

                  {audits.seo && expandedConfig.seo && (
                    <>
                      <Separator />
                      <div className="p-4 space-y-4">
                        <p className="text-xs font-semibold text-[#79C300] uppercase tracking-wide">Paramètres SEO</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Checkbox label="Vérifier H1" value={seoConfig.check_h1} onChange={(v) => setSeoConfig((s) => ({ ...s, check_h1: v }))} />
                          <Checkbox label="Meta description" value={seoConfig.check_meta_description} onChange={(v) => setSeoConfig((s) => ({ ...s, check_meta_description: v }))} />
                          <Checkbox label="Longueur titre" value={seoConfig.check_title_length} onChange={(v) => setSeoConfig((s) => ({ ...s, check_title_length: v }))} />
                          <Checkbox label="Canonical" value={seoConfig.check_canonical} onChange={(v) => setSeoConfig((s) => ({ ...s, check_canonical: v }))} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <NumberInput
                            label="Titre minimum"
                            value={seoConfig.title_min_length}
                            min={1}
                            max={100}
                            disabled={!seoConfig.check_title_length}
                            onChange={(v) => setSeoConfig((s) => ({ ...s, title_min_length: v }))}
                          />
                          <NumberInput
                            label="Titre maximum"
                            value={seoConfig.title_max_length}
                            min={1}
                            max={100}
                            disabled={!seoConfig.check_title_length}
                            onChange={(v) => setSeoConfig((s) => ({ ...s, title_max_length: v }))}
                          />
                          <NumberInput
                            label="Meta description minimum"
                            value={seoConfig.meta_desc_min_length}
                            min={1}
                            max={500}
                            disabled={!seoConfig.check_meta_description}
                            onChange={(v) => setSeoConfig((s) => ({ ...s, meta_desc_min_length: v }))}
                          />
                          <NumberInput
                            label="Meta description maximum"
                            value={seoConfig.meta_desc_max_length}
                            min={1}
                            max={500}
                            disabled={!seoConfig.check_meta_description}
                            onChange={(v) => setSeoConfig((s) => ({ ...s, meta_desc_max_length: v }))}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Performance Card */}
                <div className={`rounded-lg border transition-all ${audits.performance ? 'border-black bg-green-50/20' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Zap className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-base font-medium text-gray-900">Performance</p>
                        <p className="text-xs text-gray-500 mt-0.5">Vitesse, LCP, TTFB, CLS</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {audits.performance && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleConfig("performance")}
                          className="h-8 px-2"
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          <ChevronDown className={`h-4 w-4 transition-transform ${expandedConfig.performance ? "rotate-180" : ""}`} />
                        </Button>
                      )}
                      <Toggle value={audits.performance} onChange={(v) => setAudits((a) => ({ ...a, performance: v }))} />
                    </div>
                  </div>

                  {audits.performance && expandedConfig.performance && (
                    <>
                      <Separator />
                      <div className="p-4 space-y-4">
                        <p className="text-xs font-semibold text-[#79C300] uppercase tracking-wide">Paramètres Performance</p>

                        <NumberInput
                          label="Concurrence Lighthouse"
                          value={perfConfig.lighthouse_concurrency}
                          min={1}
                          max={10}
                          onChange={(v) => setPerfConfig((p) => ({ ...p, lighthouse_concurrency: v }))}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <NumberInput label="TTFB (ms)" value={perfConfig.ttfb_ms} onChange={(v) => setPerfConfig((p) => ({ ...p, ttfb_ms: v }))} />
                          <NumberInput label="LCP (ms)" value={perfConfig.lcp_ms} onChange={(v) => setPerfConfig((p) => ({ ...p, lcp_ms: v }))} />
                          <NumberInput label="CLS" value={perfConfig.cls} step={0.01} onChange={(v) => setPerfConfig((p) => ({ ...p, cls: v }))} />
                          <NumberInput label="Score minimum" value={perfConfig.score_min} step={0.01} min={0} max={1} onChange={(v) => setPerfConfig((p) => ({ ...p, score_min: v }))} />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Security Card */}
                <div className={`rounded-lg border transition-all ${audits.security ? 'border-black bg-green-50/20' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <ShieldCheck className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-base font-medium text-gray-900">Sécurité</p>
                        <p className="text-xs text-gray-500 mt-0.5">SSL, headers, HTTPS</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {audits.security && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleConfig("security")}
                          className="h-8 px-2"
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          <ChevronDown className={`h-4 w-4 transition-transform ${expandedConfig.security ? "rotate-180" : ""}`} />
                        </Button>
                      )}
                      <Toggle value={audits.security} onChange={(v) => setAudits((a) => ({ ...a, security: v }))} />
                    </div>
                  </div>

                  {audits.security && expandedConfig.security && (
                    <>
                      <Separator />
                      <div className="p-4 space-y-4">
                        <p className="text-xs font-semibold text-[#79C300] uppercase tracking-wide">Paramètres Sécurité</p>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">Vérifier SSL</span>
                            <Toggle value={secConfig.check_ssl} onChange={(v) => setSecConfig((s) => ({ ...s, check_ssl: v }))} />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-sm text-gray-700">Vérifier les headers</span>
                              <span className="text-xs text-gray-400">Active les vérifications des headers HTTP</span>
                            </div>
                            <Toggle value={secConfig.check_headers} onChange={(v) => setSecConfig((s) => ({ ...s, check_headers: v }))} />
                          </div>
                        </div>

                        <div className={!secConfig.check_ssl ? "opacity-50 pointer-events-none" : ""}>
                          <NumberInput
                            label="Alerte SSL avant expiration (jours)"
                            value={secConfig.ssl_days_warning}
                            min={1}
                            max={365}
                            disabled={!secConfig.check_ssl}
                            onChange={(v) => setSecConfig((s) => ({ ...s, ssl_days_warning: v }))}
                          />
                        </div>

                        <div className={!secConfig.check_headers ? "opacity-50 pointer-events-none" : ""}>
                          <p className="text-xs font-semibold text-gray-600 mb-2">Headers HTTP requis</p>
                          <div className="space-y-2">
                            <Checkbox
                              label="Strict-Transport-Security (HSTS)"
                              value={secConfig.header_hsts}
                              disabled={!secConfig.check_headers}
                              onChange={(v) => setSecConfig((s) => ({ ...s, header_hsts: v }))}
                            />
                            <Checkbox
                              label="Content-Security-Policy (CSP)"
                              value={secConfig.header_csp}
                              disabled={!secConfig.check_headers}
                              onChange={(v) => setSecConfig((s) => ({ ...s, header_csp: v }))}
                            />
                            <Checkbox
                              label="X-Frame-Options"
                              value={secConfig.header_xframe}
                              disabled={!secConfig.check_headers}
                              onChange={(v) => setSecConfig((s) => ({ ...s, header_xframe: v }))}
                            />
                            <Checkbox
                              label="X-Content-Type-Options"
                              value={secConfig.header_xcontent}
                              disabled={!secConfig.check_headers}
                              onChange={(v) => setSecConfig((s) => ({ ...s, header_xcontent: v }))}
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleBack} className="flex-1 h-11 rounded-lg">
                Retour
              </Button>
              <button
                onClick={handleNext}
                className="flex-1 h-11 bg-[#79C300] text-white rounded-lg font-medium shadow-sm cursor-pointer hover:bg-[#6aad00] transition-colors"
              >
                Continuer
              </button>
            </div>
          </div>
        )}

        {/* Step 2 : Configuration */}
        {step === 2 && (
          <div className="space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Paramètres du crawl</CardTitle>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="Nombre max de pages" hint="50 = rapide · 200+ = complet">
                    <Input type="number" value={maxPages} onChange={e => setMaxPages(parseInt(e.target.value))} className="h-11" />
                  </Field>

                  <Field label="Profondeur max" hint="Niveaux de liens explorés">
                    <Input type="number" value={maxDepth} onChange={e => setMaxDepth(parseInt(e.target.value))} className="h-11" />
                  </Field>

                  <Field label="Concurrence" hint="5–10 recommandé">
                    <Input type="number" value={concurrency} onChange={e => setConcurrency(parseInt(e.target.value))} className="h-11" />
                  </Field>

                  <Field label="Délai requêtes (ms)" hint="Anti-bot / rate limit">
                    <Input type="number" value={delayMs} onChange={e => setDelayMs(parseInt(e.target.value))} className="h-11" />
                  </Field>
                </div>

                <Separator />

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-gray-900">Respect robots.txt</p>
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">Recommandé</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Suit les règles définies dans le fichier <code className="text-xs bg-gray-200 px-1 py-0.5 rounded">robots.txt</code> du site
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Désactivez cette option pour forcer l&apos;exploration des pages normalement interdites
                      </p>
                    </div>
                    <div className="ml-4">
                      <Toggle value={respectRobots} onChange={setRespectRobots} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span className="text-xl">🔐</span> Authentification
                </CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Configurez l&apos;accès à un site protégé par mot de passe
                </p>
              </CardHeader>

              <CardContent className="space-y-5">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Activer 	l&apos;authentification</p>
                    <p className="text-xs text-gray-500">Activez si votre site nécessite une connexion</p>
                  </div>
                  <Toggle value={hasAuth} onChange={setHasAuth} />
                </div>

                {hasAuth && (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-700 block mb-1.5">
                          URL de connexion
                        </Label>
                        <Input
                          placeholder="https://exemple.com/login"
                          value={authLoginUrl}
                          onChange={e => setAuthLoginUrl(e.target.value)}
                          className="h-11"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          L&apos;URL où se trouve le formulaire de connexion
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-700 block mb-1.5">
                            Nom d&apos;utilisateur
                          </Label>
                          <Input
                            placeholder="admin@exemple.com"
                            value={authUser}
                            onChange={e => setAuthUser(e.target.value)}
                            className="h-11"
                          />
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-gray-700 block mb-1.5">
                            Mot de passe
                          </Label>
                          <Input
                            placeholder="••••••••"
                            type="password"
                            value={authPass}
                            onChange={e => setAuthPass(e.target.value)}
                            className="h-11"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleBack} className="flex-1 h-11 rounded-lg">
                Retour
              </Button>
              <button
                onClick={handleNext}
                className="flex-1 h-11 bg-[#79C300] text-white rounded-lg font-medium shadow-sm cursor-pointer hover:bg-[#6aad00] transition-colors"
              >
                Continuer
              </button>
            </div>
          </div>
        )}

        {/* Step 3 : Récapitulatif */}
        {step === 3 && (
          <div className="space-y-6">
            <Card className="border-0 shadow-sm overflow-hidden">
              <CardHeader className="pb-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold text-gray-900">Récapitulatif de l&apos;audit</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      Vérifiez l&apos;ensemble des paramètres avant de lancer l&apos;analyse
                    </p>
                  </div>
                  <div className="hidden sm:block">
                    <div className="px-3 py-1.5 bg-[#79C300]/10 rounded-full">
                      <span className="text-xs font-semibold text-[#79C300]">{selectedCount} module{selectedCount > 1 ? "s" : ""} actif{selectedCount > 1 ? "s" : ""}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                        <span className="text-base">🌐</span>
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900">Site web</h3>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">URL</p>
                        <p className="text-sm font-medium text-gray-900 break-all font-mono">{url}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">CMS détecté</p>
                        <p className="text-sm font-medium text-gray-900">{cms || "Non détecté"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                        <span className="text-base">🎯</span>
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900">Modules activés</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {audits.seo && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-sm font-medium">
                          <Search size={12} /> SEO
                        </span>
                      )}
                      {audits.performance && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-sm font-medium">
                          <Zap size={12} /> Performance
                        </span>
                      )}
                      {audits.security && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-sm font-medium">
                          <ShieldCheck size={12} /> Sécurité
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
                      <span className="text-base">🕷️</span>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">Configuration du crawl</h3>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Pages max</p>
                      <p className="text-base font-semibold text-gray-900">{maxPages}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Profondeur</p>
                      <p className="text-base font-semibold text-gray-900">{maxDepth}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Concurrence</p>
                      <p className="text-base font-semibold text-gray-900">{concurrency}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Délai</p>
                      <p className="text-base font-semibold text-gray-900">{delayMs} ms</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Respect robots.txt</p>
                        <p className="text-xs text-gray-500"> Suit les règles d&apos;exploration du site</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${respectRobots ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {respectRobots ? "Activé" : "Désactivé"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {audits.seo && (
                    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                          <Search size={14} className="text-blue-600" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900">Paramètres SEO</h3>
                      </div>
                      <div className="space-y-3">
                        {seoConfig.check_title_length && (
                          <div>
                            <p className="text-xs text-gray-400 mb-0.5">Longueur du titre</p>
                            <p className="text-sm font-medium text-gray-900">{seoConfig.title_min_length} - {seoConfig.title_max_length} caractères</p>
                          </div>
                        )}
                        {seoConfig.check_meta_description && (
                          <div>
                            <p className="text-xs text-gray-400 mb-0.5">Meta description</p>
                            <p className="text-sm font-medium text-gray-900">{seoConfig.meta_desc_min_length} - {seoConfig.meta_desc_max_length} caractères</p>
                          </div>
                        )}
                        {(seoConfig.check_h1 || seoConfig.check_meta_description || seoConfig.check_title_length || seoConfig.check_canonical) && (
                          <div className="flex flex-wrap gap-1.5 pt-2">
                            {seoConfig.check_h1 && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">✓ Vérifier H1</span>}
                            {seoConfig.check_meta_description && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">✓ Meta description</span>}
                            {seoConfig.check_title_length && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">✓ Longueur titre</span>}
                            {seoConfig.check_canonical && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">✓ Canonical</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {audits.performance && (
                    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-lg bg-yellow-50 flex items-center justify-center">
                          <Zap size={14} className="text-yellow-600" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900">Paramètres Performance</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">TTFB</p>
                          <p className="text-sm font-semibold text-gray-900">{perfConfig.ttfb_ms} ms</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">LCP</p>
                          <p className="text-sm font-semibold text-gray-900">{perfConfig.lcp_ms} ms</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">CLS</p>
                          <p className="text-sm font-semibold text-gray-900">{perfConfig.cls}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Score minimum</p>
                          <p className="text-sm font-semibold text-gray-900">{(perfConfig.score_min * 100)}%</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {audits.security && (
                    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                          <ShieldCheck size={14} className="text-red-600" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900">Paramètres Sécurité</h3>
                      </div>
                      <div className="space-y-3">
                        {secConfig.check_ssl && (
                          <div>
                            <p className="text-xs text-gray-400 mb-0.5">Alerte SSL</p>
                            <p className="text-sm font-medium text-gray-900">{secConfig.ssl_days_warning} jours avant expiration</p>
                          </div>
                        )}
                        {secConfig.check_headers && (
                          <div>
                            <p className="text-xs text-gray-400 mb-1.5">Headers vérifiés</p>
                            <div className="flex flex-wrap gap-1.5">
                              {secConfig.header_hsts && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">✓ HSTS</span>}
                              {secConfig.header_csp && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">✓ CSP</span>}
                              {secConfig.header_xframe && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">✓ X-Frame</span>}
                              {secConfig.header_xcontent && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">✓ X-Content</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {!respectRobots && (
                  <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                    <span className="text-lg">⚠️</span>
                    <div>
                      <p className="text-sm font-medium text-yellow-800">Respect robots.txt désactivé</p>
                      <p className="text-xs text-yellow-700 mt-0.5">
                        l&apos;exploration ignorera les règles du site, ce qui peut surcharger le serveur
                      </p>
                    </div>
                  </div>
                )}

                {hasAuth && !authLoginUrl && (
                  <div className="flex items-start gap-3 p-4 bg-orange-50 rounded-xl border border-orange-200">
                    <span className="text-lg">🔐</span>
                    <div>
                      <p className="text-sm font-medium text-orange-800">Authentification activée sans URL</p>
                      <p className="text-xs text-orange-700 mt-0.5">
                        Veuillez renseigner l&apos;URL de connexion pour que l&apos;audit puisse accéder au site
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {launchError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle size={16} className="text-red-500" />
                <p className="text-sm text-red-600">{launchError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleBack} className="flex-1 h-11 rounded-lg">
                Retour
              </Button>
              <button
                onClick={handleLaunch}
                disabled={launching}
                className="flex-1 h-11 bg-[#79C300] text-white rounded-lg font-medium shadow-sm cursor-pointer hover:bg-[#6aad00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {launching ? "Lancement..." : "Lancer l&apos;audit"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}