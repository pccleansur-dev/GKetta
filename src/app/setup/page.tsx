import { redirect } from "next/navigation";

import { SetupWizard } from "@/components/setup/setup-wizard";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const done = await db.systemConfig.findUnique({ where: { key: "setup_completed" } });
  if (done?.value === "true") {
    redirect("/");
  }

  const isDocker = process.env.NODE_ENV === "production";

  return <SetupWizard isDocker={isDocker} />;
}
