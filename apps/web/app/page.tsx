"use client";

import { useState } from "react";
import { Home } from "@/components/Home";
import { LoginPanel } from "@/components/LoginPanel";
import { ProfileForm } from "@/components/ProfileForm";
import { useSession } from "@/components/SessionProvider";
import { useI18n } from "@/lib/i18n";
import { WalkScreen } from "@/components/WalkScreen";

export default function Page() {
  const { me, loading } = useSession();
  const { t } = useI18n();
  const [view, setView] = useState<"home" | "walk">("home");
  return (
    <main className="flex min-h-dvh items-center px-4 py-10">
      {loading ? <p className="mx-auto text-slate-300">{t("common.loading")}</p>
        : !me ? <LoginPanel />
        : !me.profile_complete ? <ProfileForm />
        : view === "walk" ? <WalkScreen onExit={() => setView("home")} />
        : <Home onWalk={() => setView("walk")} />}
    </main>
  );
}
