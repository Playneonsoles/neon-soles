"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export function Back() {
  const { t } = useI18n();
  return <Link href="/" className="text-sm text-slate-300 underline underline-offset-4">{t("common.back")}</Link>;
}
