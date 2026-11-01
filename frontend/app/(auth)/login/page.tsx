"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import api from "@/lib/axios";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "L'e-mail est obligatoire")
    .email("Format d'e-mail invalide"),
  password: z
    .string()
    .min(1, "Le mot de passe est obligatoire")
    .min(8, "Minimum 8 caractères"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPwd, setShowPwd] = useState(false);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginForm) {
  setServerError("");
  try {
    const res = await api.post("/auth/login", {
      email: data.email,
      password: data.password,
    });
    
    // Store token
    const token = res.data.access_token;
    localStorage.setItem("access_token", token);
    
    // ✅ DEBUG: Decode and log JWT token
    try {
      const tokenParts = token.split('.');
      const payload = JSON.parse(atob(tokenParts[1]));
      console.log("🔍 JWT Payload:", payload);
      console.log("🔍 User ID in token:", payload.sub || payload.id || payload.userId);
    } catch (e) {
      console.error("❌ Failed to decode token:", e);
    }
    
    const userData = res.data.user;
    console.log("🔍 User data from login:", userData);
    
    // Store user info
    const fullName = [userData.prenom, userData.nom].filter(Boolean).join(" ") || userData.email;
    const userRole = userData.role || "USER";
    
    localStorage.setItem("user_role", userRole);
    localStorage.setItem("user_name", fullName);
    localStorage.setItem("user_id", userData.id); // ✅ Also store user ID
    
    console.log("✅ Stored in localStorage:", {
      role: localStorage.getItem("user_role"),
      name: localStorage.getItem("user_name"),
      userId: localStorage.getItem("user_id"),
      hasToken: !!localStorage.getItem("access_token")
    });
    
    router.push("/dashboard/new");
  } catch (error) {
    console.error("❌ Login error:", error);
    setServerError("E-mail ou mot de passe invalide");
  }
}

  return (
    <div className="w-full min-h-screen bg-white overflow-y-auto">
      <div className="flex min-h-screen">
        {/* Left Panel - Decorative */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#1A3D2E] to-[#0D261C] flex-col justify-between p-12 relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#79C300]/10" />
          <div className="absolute -bottom-32 -right-16 w-80 h-80 rounded-full bg-[#79C300]/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-[#79C300]/5" />

          {/* Logo */}
          <div className="relative z-10">
            <Image
              src="/logo.jpg"
              alt="PixiMind"
              width="150"
              height="50"
            />
          </div>

          {/* Center content */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-[#79C300]/15 border border-[#79C300]/30 rounded-full px-4 py-1.5 mb-6">
              <div className="w-2 h-2 rounded-full bg-[#79C300] animate-pulse" />
              <span className="text-[#79C300] text-xs font-medium">Plateforme d&apos;audit automatisé</span>
            </div>
            <h2 className="text-3xl font-bold text-white leading-tight mb-4">
              Analysez vos sites web<br />
              <span className="text-[#79C300]">en quelques secondes</span>
            </h2>
            <p className="text-white/50 text-sm leading-relaxed">
              SEO, Performance, SSL — obtenez un rapport complet
              avec des recommandations priorisées par IA. TEST TEST TEST
            </p>
          </div>

          {/* Stats */}
          <div className="relative z-10 grid grid-cols-3 gap-4">
            {[
              { value: "SEO", label: "Analyse complète", icon: "🔍" },
              { value: "Performance", label: "Vitesse optimisée", icon: "⚡" },
              { value: "Sécurité", label: "Vérifiée en continu", icon: "🛡️" },
            ].map((s) => (
              <div key={s.label} className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-all">
                <div className="text-2xl mb-2">{s.icon}</div>
                <div className="text-[#79C300] font-bold text-lg">{s.value}</div>
                <div className="text-white/40 text-xs mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            {/* Logo mobile — couleur normale */}
            <div className="flex lg:hidden mb-10">
              <Image
                src="/logo.jpg"
                alt="PixiMind"
                width={130}
                height={45}
                className="object-contain"
              />
            </div>

            {/* Header */}
            <div className="text-center lg:text-left mb-8">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Connexion
              </h1>
              <p className="text-sm text-gray-500">
                Accédez à votre espace d&apos;audit PixiAudit
              </p>
            </div>

            {/* Server Error */}
            {serverError && (
              <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-600 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  {serverError}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Adresse e-mail
                </Label>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="vous@exemple.com"
                  {...register("email")}
                  className={`h-11 rounded-lg border-gray-200 focus:border-[#79C300] focus:ring-[#79C300] ${errors.email ? "border-red-500" : ""
                    }`}
                />
                {errors.email && (
                  <p className="text-xs text-red-500">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">
                    Mot de passe
                  </Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-[#79C300] hover:text-[#6aad00] transition font-medium"
                  >
                    Mot de passe oublié ?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    type={showPwd ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    {...register("password")}
                    className={`h-11 rounded-lg border-gray-200 focus:border-[#79C300] focus:ring-[#79C300] pr-11 ${errors.password ? "border-red-500" : ""
                      }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-500">{errors.password.message}</p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 bg-[#79C300] text-white rounded-lg font-medium shadow-sm hover:bg-[#6aad00] transition-colors"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isSubmitting ? "Connexion..." : "Se connecter"}
              </Button>
            </form>

            {/* Footer */}
            <p className="text-center text-xs text-gray-400 mt-8">
              © {new Date().getFullYear()} PixiMind — Tous droits réservés
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}