"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, CheckCircle2, ArrowLeft, Shield, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import api from "@/lib/axios";

const schema = z
  .object({
    password: z
      .string()
      .min(1, "Le mot de passe est obligatoire")
      .min(8, "Minimum 8 caractères")
      .regex(/[A-Z]/, "Au moins 1 lettre majuscule")
      .regex(/[a-z]/, "Au moins 1 lettre minuscule")
      .regex(/[^A-Za-z0-9]/, "Au moins 1 caractère spécial"),
    confirm: z.string().min(1, "La confirmation est obligatoire"),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirm"],
  });

type ResetForm = z.infer<typeof schema>;

const rules = [
  { label: "8 caractères minimum", test: (v: string) => v.length >= 8 },
  { label: "1 lettre majuscule", test: (v: string) => /[A-Z]/.test(v) },
  { label: "1 lettre minuscule", test: (v: string) => /[a-z]/.test(v) },
  { label: "1 caractère spécial", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState("");
  const [pwdValue, setPwdValue] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({ resolver: zodResolver(schema) });

  async function onSubmit(data: ResetForm) {
    setServerError("");
    if (!token) {
      setServerError("Lien invalide ou expiré. Veuillez refaire une demande.");
      return;
    }
    try {
      await api.post("/auth/reset-password", { token, password: data.password });
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch {
      setServerError("Lien invalide ou expiré. Veuillez refaire une demande.");
    }
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8 text-[#79C300]" />
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
          Mot de passe réinitialisé !
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Vous allez être redirigé vers la connexion dans 3 secondes...
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-[#79C300] hover:text-[#6aad00] font-medium transition"
        >
          Aller à la connexion maintenant →
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="text-center lg:text-left mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
          Nouveau mot de passe
        </h1>
        <p className="text-sm text-gray-500">
          Choisissez un mot de passe sécurisé pour votre compte.
        </p>
      </div>

      {serverError && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-600 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            {serverError}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {/* New Password */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">
            Nouveau mot de passe
          </Label>
          <div className="relative">
            <Input
              type={showPwd ? "text" : "password"}
              placeholder="••••••••"
              {...register("password", {
                onChange: (e) => setPwdValue(e.target.value),
              })}
              className={`h-11 rounded-lg border-gray-200 focus:border-[#79C300] focus:ring-[#79C300] pr-11 ${
                errors.password ? "border-red-500" : ""
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

          {/* Password rules indicator */}
          {pwdValue.length > 0 && (
            <div className="mt-3 p-3 bg-gray-50 border border-gray-100 rounded-lg grid grid-cols-2 gap-2">
              {rules.map((rule) => (
                <div
                  key={rule.label}
                  className={`flex items-center gap-2 text-xs transition-colors ${
                    rule.test(pwdValue) ? "text-[#79C300]" : "text-gray-400"
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
                    rule.test(pwdValue) ? "bg-[#79C300]" : "bg-gray-300"
                  }`} />
                  {rule.label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">
            Confirmer le mot de passe
          </Label>
          <div className="relative">
            <Input
              type={showConfirm ? "text" : "password"}
              placeholder="••••••••"
              {...register("confirm")}
              className={`h-11 rounded-lg border-gray-200 focus:border-[#79C300] focus:ring-[#79C300] pr-11 ${
                errors.confirm ? "border-red-500" : ""
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.confirm && (
            <p className="text-xs text-red-500">{errors.confirm.message}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 bg-[#79C300] text-white rounded-lg font-medium shadow-sm hover:bg-[#6aad00] transition-colors"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isSubmitting ? "Enregistrement..." : "Réinitialiser le mot de passe"}
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
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
              width={150}
              height={50}
            />
          </div>

          {/* Center content */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-[#79C300]/15 border border-[#79C300]/30 rounded-full px-4 py-1.5 mb-6">
              <Lock className="w-3 h-3 text-[#79C300]" />
              <span className="text-[#79C300] text-xs font-medium">Sécurité du compte</span>
            </div>
            <h2 className="text-3xl font-bold text-white leading-tight mb-4">
              Sécurisez votre<br />
              <span className="text-[#79C300]">nouveau mot de passe</span>
            </h2>
            <p className="text-white/50 text-sm leading-relaxed">
              Choisissez un mot de passe fort pour protéger
              votre compte PixiAudit.
            </p>
          </div>

          {/* Security rules */}
          <div className="relative z-10 bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-[#79C300]" />
              <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">
                Règles de sécurité
              </p>
            </div>
            {rules.map((rule) => (
              <div key={rule.label} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-[#79C300]/20 border border-[#79C300]/30 flex items-center justify-center flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#79C300]" />
                </div>
                <span className="text-white/50 text-sm">{rule.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="flex lg:hidden justify-center mb-10">
              <Image
                src="/logo.jpg"
                alt="PixiMind"
                width={130}
                height={45}
                className="object-contain"
              />
            </div>

            <Suspense
              fallback={
                <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Chargement...
                </div>
              }
            >
              <ResetPasswordForm />
            </Suspense>

            {/* Back to Login */}
            <div className="mt-8 flex justify-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour à la connexion
              </Link>
            </div>

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