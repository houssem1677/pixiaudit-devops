"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

type AnomalyLevel = "Critique" | "Important" | "Amélioration";

interface Thresholds {
  good: number;
  ok: number;
}

interface Weights {
  seo: number;
  performance: number;
  security: number;
}

// ✅ NEW INTERFACES
interface SeoDeductions {
  H1_MISSING: number;
  META_MISSING: number;
  TITLE_MISSING: number;
  TITLE_TOO_SHORT: number;
  TITLE_TOO_LONG: number;
  META_TOO_SHORT: number;
  META_TOO_LONG: number;
  H1_MULTIPLE: number;
}

interface SecurityScoring {
  sslValid: number;
  sslExpiringSoon: number;
  headerPresent: number;
  headerMissing: number;
}

interface Anomaly {
  key: string;
  level: AnomalyLevel;
}

const ALL_ANOMALIES: string[] = [
  "H1_MISSING", "META_MISSING", "TITLE_MISSING", "HIGH_TTFB", "HIGH_LCP",
  "RENDER_BLOCKING_SCRIPTS", "MISSING_HEADER", "SSL_INVALID",
  "TITLE_TOO_SHORT", "TITLE_TOO_LONG", "META_TOO_SHORT", "META_TOO_LONG",
  "HIGH_CLS", "IMAGES_WITHOUT_LAZY_LOADING", "IMAGES_WITHOUT_DIMENSIONS",
  "SSL_EXPIRING_SOON", "IMAGES_WITHOUT_SRCSET",
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function SettingsPage() {
  const [thresholds, setThresholds] = useState<Thresholds>({ good: 70, ok: 50 });
  const [weights, setWeights] = useState<Weights>({ seo: 40, performance: 40, security: 20 });
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  
  // ✅ NEW STATE
  const [seoDeductions, setSeoDeductions] = useState<SeoDeductions>({
    H1_MISSING: 15,
    META_MISSING: 12,
    TITLE_MISSING: 12,
    TITLE_TOO_SHORT: 5,
    TITLE_TOO_LONG: 3,
    META_TOO_SHORT: 5,
    META_TOO_LONG: 3,
    H1_MULTIPLE: 5,
  });
  
  const [securityScoring, setSecurityScoring] = useState<SecurityScoring>({
    sslValid: 50,
    sslExpiringSoon: -5,
    headerPresent: 10,
    headerMissing: -10,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Helper function to get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem("access_token");
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setIsLoading(true);
      
      const token = localStorage.getItem("access_token");
      const headers: HeadersInit = {};
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${API_URL}/settings`, { headers });
      
      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid
          localStorage.removeItem("access_token");
          localStorage.removeItem("user_name");
          localStorage.removeItem("user_role");
          window.location.href = "/login";
          return;
        }
        throw new Error("Failed to load settings");
      }
      
      const data = await response.json();
      
      setThresholds(data.thresholds);
      setWeights(data.weights);
      
      const anomalyArray: Anomaly[] = ALL_ANOMALIES.map(key => ({
        key,
        level: data.anomalyLevels[key] || getDefaultLevel(key),
      }));
      setAnomalies(anomalyArray);
      
      // ✅ Load scoring parameters
      if (data.seoDeductions) setSeoDeductions(data.seoDeductions);
      if (data.securityScoring) setSecurityScoring(data.securityScoring);
      
      console.log("Settings loaded:", data);
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Erreur lors du chargement des paramètres");
    } finally {
      setIsLoading(false);
    }
  }

  function getDefaultLevel(key: string): AnomalyLevel {
    const critiqueList = ["H1_MISSING", "META_MISSING", "TITLE_MISSING", "HIGH_TTFB", "HIGH_LCP", "RENDER_BLOCKING_SCRIPTS", "MISSING_HEADER", "SSL_INVALID"];
    const importantList = ["TITLE_TOO_SHORT", "TITLE_TOO_LONG", "META_TOO_SHORT", "META_TOO_LONG", "HIGH_CLS", "IMAGES_WITHOUT_LAZY_LOADING", "IMAGES_WITHOUT_DIMENSIONS", "SSL_EXPIRING_SOON"];
    if (critiqueList.includes(key)) return "Critique";
    if (importantList.includes(key)) return "Important";
    return "Amélioration";
  }

  const handleThresholdChange = (key: keyof Thresholds, value: number) => {
    setThresholds(prev => ({ ...prev, [key]: value }));
  };

  const handleWeightChange = (changedKey: keyof Weights, newValue: number) => {
    const oldValue = weights[changedKey];
    const diff = newValue - oldValue;
    const otherKeys = Object.keys(weights).filter(k => k !== changedKey) as (keyof Weights)[];
    const otherTotal = weights[otherKeys[0]] + weights[otherKeys[1]];
    if (otherTotal === 0) return;

    const newWeights = { ...weights };
    newWeights[changedKey] = newValue;

    otherKeys.forEach(key => {
      const proportion = weights[key] / otherTotal;
      const adjustment = diff * proportion;
      let newOtherValue = Math.max(0, Math.min(100, Math.round(weights[key] - adjustment)));
      newWeights[key] = newOtherValue;
    });

    const total = newWeights.seo + newWeights.performance + newWeights.security;
    if (total !== 100 && newWeights[changedKey] > 0) {
      const largestKey = otherKeys.reduce((a, b) => newWeights[a] > newWeights[b] ? a : b);
      newWeights[largestKey] += (100 - total);
    }

    setWeights(newWeights);
  };

  const handleAnomalyLevelChange = (key: string, newLevel: AnomalyLevel) => {
    setAnomalies(prev => prev.map(anomaly =>
      anomaly.key === key ? { ...anomaly, level: newLevel } : anomaly
    ));
  };

  // ✅ NEW HANDLERS
  const handleSeoDeductionChange = (key: keyof SeoDeductions, value: number) => {
    setSeoDeductions(prev => ({ ...prev, [key]: value }));
  };

  const handleSecurityScoringChange = (key: keyof SecurityScoring, value: number) => {
    setSecurityScoring(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const anomalyLevels: Record<string, AnomalyLevel> = {};
      anomalies.forEach(anomaly => {
        anomalyLevels[anomaly.key] = anomaly.level;
      });

      const token = localStorage.getItem("access_token");
      if (!token) {
        toast.error("Non autorisé");
        setIsSaving(false);
        return;
      }

      const response = await fetch(`${API_URL}/settings`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          thresholds,
          weights,
          anomalyLevels,
          seoDeductions,       // ✅ NEW
          securityScoring,     // ✅ NEW
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid
          localStorage.removeItem("access_token");
          localStorage.removeItem("user_name");
          localStorage.removeItem("user_role");
          window.location.href = "/login";
          return;
        }
        if (response.status === 403) throw new Error("Accès refusé");
        throw new Error("Failed to save");
      }

      toast.success("Paramètres sauvegardés !");
    } catch (error: any) {
      console.error("Error:", error);
      toast.error("Erreur", { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const getAnomalyStyle = (level: AnomalyLevel) => {
    switch (level) {
      case "Critique": return { bg: "bg-red-100", text: "text-red-700", border: "border-red-200" };
      case "Important": return { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-200" };
      case "Amélioration": return { bg: "bg-green-100", text: "text-green-700", border: "border-green-200" };
    }
  };

  if (isLoading) {
    return (
      <div className="w-full min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#79C300] mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-white">
      <div className="w-full max-w-7xl mx-auto px-6 pt-8 pb-12 md:px-8 md:pt-12 md:pb-16">
        
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Paramètres PixiAudit</h1>
          <p className="text-sm md:text-base text-gray-500">
            Configuration complète du moteur de scoring
          </p>
        </div>

        <div className="flex justify-end mb-6">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="h-11 bg-[#79C300] text-white rounded-lg font-medium shadow-sm hover:bg-[#6aad00] px-6"
          >
            {isSaving ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </div>

        {/* Thresholds & Weights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">🎯 Seuils de score</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="flex justify-between mb-2">
                  <Label>🟢 Amélioration</Label>
                  <span className="text-sm font-semibold text-green-600">{thresholds.good}%</span>
                </div>
                <input type="range" min="0" max="100" value={thresholds.good}
                  onChange={(e) => handleThresholdChange("good", parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#79C300]" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <Label>🟡 Important</Label>
                  <span className="text-sm font-semibold text-yellow-600">{thresholds.ok}%</span>
                </div>
                <input type="range" min="0" max="100" value={thresholds.ok}
                  onChange={(e) => handleThresholdChange("ok", parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#79C300]" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">⚖️ Poids des modules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {Object.entries(weights).map(([key, value]) => {
                const name = { seo: "SEO", performance: "Performance", security: "Sécurité" }[key as keyof Weights];
                return (
                  <div key={key}>
                    <div className="flex justify-between mb-2">
                      <Label>{name}</Label>
                      <span className="text-sm font-semibold">{value}%</span>
                    </div>
                    <input type="range" min="0" max="100" value={value}
                      onChange={(e) => handleWeightChange(key as keyof Weights, parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#79C300]" />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* ✅ NEW - SEO Deductions */}
        <Card className="border-0 shadow-sm mb-8">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">🔢 SEO - Points de déduction</CardTitle>
            <p className="text-sm text-gray-500 mt-1">Points déduits pour chaque anomalie</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(seoDeductions).map(([key, value]) => (
                <div key={key}>
                  <div className="flex justify-between mb-2">
                    <Label className="text-sm font-medium">{key}</Label>
                    <span className="text-sm font-semibold text-red-600">-{value} pts</span>
                  </div>
                  <input type="range" min="0" max="30" value={value}
                    onChange={(e) => handleSeoDeductionChange(key as keyof SeoDeductions, parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#79C300]" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ✅ NEW - Security Scoring */}
        <Card className="border-0 shadow-sm mb-8">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">🔒 Security - Points de scoring</CardTitle>
            <p className="text-sm text-gray-500 mt-1">Points attribués pour chaque élément</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="flex justify-between mb-2">
                <Label>SSL Valide</Label>
                <span className="text-sm font-semibold text-green-600">+{securityScoring.sslValid} pts</span>
              </div>
              <input type="range" min="0" max="100" value={securityScoring.sslValid}
                onChange={(e) => handleSecurityScoringChange("sslValid", parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#79C300]" />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <Label>SSL Expire Bientôt</Label>
                <span className="text-sm font-semibold text-yellow-600">{securityScoring.sslExpiringSoon} pts</span>
              </div>
              <input type="range" min="-20" max="0" value={securityScoring.sslExpiringSoon}
                onChange={(e) => handleSecurityScoringChange("sslExpiringSoon", parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#79C300]" />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <Label>Header Présent</Label>
                <span className="text-sm font-semibold text-green-600">+{securityScoring.headerPresent} pts</span>
              </div>
              <input type="range" min="0" max="20" value={securityScoring.headerPresent}
                onChange={(e) => handleSecurityScoringChange("headerPresent", parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#79C300]" />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <Label>Header Manquant</Label>
                <span className="text-sm font-semibold text-red-600">{securityScoring.headerMissing} pts</span>
              </div>
              <input type="range" min="-30" max="0" value={securityScoring.headerMissing}
                onChange={(e) => handleSecurityScoringChange("headerMissing", parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#79C300]" />
            </div>
          </CardContent>
        </Card>

        {/* Anomalies Table */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-lg font-semibold">🏷️ Anomalies - Classification</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Anomalie</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Niveau</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {anomalies.map((anomaly) => {
                  const style = getAnomalyStyle(anomaly.level);
                  return (
                    <tr key={anomaly.key} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">{anomaly.key}</code>
                       </td>
                      <td className="px-6 py-4">
                        <select
                          value={anomaly.level}
                          onChange={(e) => handleAnomalyLevelChange(anomaly.key, e.target.value as AnomalyLevel)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer ${style.bg} ${style.text} ${style.border}`}>
                          <option value="Critique">🔴 Critique</option>
                          <option value="Important">🟡 Important</option>
                          <option value="Amélioration">🟢 Amélioration</option>
                        </select>
                       </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

      </div>
    </div>
  );
}