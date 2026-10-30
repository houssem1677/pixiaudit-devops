"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import api from "@/lib/axios";

const schema = z.object({
  email: z
    .string()
    .min(1, "L'e-mail est obligatoire")
    .email("Format d'e-mail invalide"),
});

type ForgotForm = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: ForgotForm) {
    try {
      await api.post("/auth/forgot-password", { email: data.email });
    } catch {
      // Silently fail - don't expose if email exists or not for security
    } finally {
      setSubmittedEmail(data.email);
      setSubmitted(true);
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
              width={150}
              height={50}
            />
          </div>

          {/* Center content */}
          <div className="relative z-10">
            <h2 className="text-3xl font-bold text-white leading-tight mb-4">
              Réinitialisez votre<br />
              <span className="text-[#79C300]">mot de passe</span>
            </h2>
            <p className="text-white/50 text-sm leading-relaxed">
              Saisissez votre adresse e-mail et nous vous enverrons
              un lien sécurisé pour réinitialiser votre mot de passe.
            </p>
          </div>

          {/* Steps */}
          <div className="relative z-10 space-y-4">
            {[
              { step: "01", label: "Saisissez votre e-mail" },
              { step: "02", label: "Recevez le lien par email" },
              { step: "03", label: "Créez un nouveau mot de passe" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-[#79C300]/20 border border-[#79C300]/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#79C300] text-xs font-bold">{item.step}</span>
                </div>
                <span className="text-white/60 text-sm">{item.label}</span>
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

            {!submitted ? (
              /* Form */
              <>
                <div className="text-center lg:text-left mb-8">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                    Mot de passe oublié ?
                  </h1>
                  <p className="text-sm text-gray-500">
                    Entrez votre adresse e-mail et nous vous enverrons un lien de réinitialisation.
                  </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">
                      Adresse e-mail
                    </Label>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="vous@exemple.com"
                      {...register("email")}
                      className={`h-11 rounded-lg border-gray-200 focus:border-[#79C300] focus:ring-[#79C300] ${
                        errors.email ? "border-red-500" : ""
                      }`}
                    />
                    {errors.email && (
                      <p className="text-xs text-red-500">{errors.email.message}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-11 bg-[#79C300] text-white rounded-lg font-medium shadow-sm hover:bg-[#6aad00] transition-colors"
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {isSubmitting ? "Envoi en cours..." : "Envoyer le lien"}
                  </Button>
                </form>
              </>
            ) : (
              /* Success Message */
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center mx-auto mb-6">
                  <MailCheck className="w-8 h-8 text-[#79C300]" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                  Mail envoyé avec succès !
                </h2>
                <p className="text-sm text-gray-500 mb-1">
                  Un lien de réinitialisation a été envoyé à
                </p>
                <p className="text-[#79C300] font-semibold text-sm mb-6">
                  {submittedEmail}
                </p>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <p className="text-xs text-gray-500">
                    📧 Vérifiez vos spams si vous ne trouvez pas l&apos;e-mail.
                  </p>
                </div>
              </div>
            )}

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