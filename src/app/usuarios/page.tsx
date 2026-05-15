import { DashboardShell } from "@/components/layout/dashboard-shell";
import { UsersPageClient } from "@/components/users/users-page-client";
import { canManageUsers, requireSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function UsuariosPage({ searchParams }: PageProps) {
  const currentUser = await requireSessionUser();
  const params = searchParams ? await searchParams : undefined;
  const panelParam = readSingle(params?.panel);
  const userId = readSingle(params?.userId);
  const panel = panelParam === "new" || panelParam === "edit" ? panelParam : null;

  return (
    <DashboardShell>
      <UsersPageClient
        canManage={canManageUsers(currentUser.role)}
        currentUserId={currentUser.id}
        initialPanel={panel}
        initialUserId={userId ?? null}
      />
    </DashboardShell>
  );
}
