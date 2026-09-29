import { requireViewer } from "@/lib/auth";
import { badgeCounts } from "@/lib/data/queries";
import { DATA_SOURCE } from "@/lib/data/store";
import { AppShell } from "@/components/shell/app-shell";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { admin, permissions } = await requireViewer();
  return (
    <AppShell
      viewer={{ name: admin.name, email: admin.email, role: admin.role, permissions: [...permissions] }}
      badges={permissions.has("bookings") ? badgeCounts() : { bookingsAttention: 0 }}
      demo={DATA_SOURCE === "demo"}
    >
      {children}
    </AppShell>
  );
}
