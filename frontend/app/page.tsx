// ============================================
// PAGE : Home — Redirect to Login
// ROUTE: /
// ============================================

import { redirect } from "next/navigation";

export default function Home() {
  redirect("/login");
}