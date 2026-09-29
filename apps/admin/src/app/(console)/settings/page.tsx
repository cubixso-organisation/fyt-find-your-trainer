import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/data/store";
import { PageHeader } from "@/components/ui/primitives";
import { SettingsClient } from "./settings-client";

export const metadata = { title: "Platform settings" };

export default async function SettingsPage() {
  const { admin } = await requirePermission("settings");
  const s = db().settings;
  return (
    <>
      <PageHeader title="Platform settings" description="Rules the mobile app follows for every booking. Changes are audited." />
      <SettingsClient
        initial={{
          platformName: s.platformName,
          supportEmail: s.supportEmail,
          bookingLeadHours: s.bookingLeadHours,
          cancellationWindowHours: s.cancellationWindowHours,
          reminderMinutes: s.reminderMinutes,
          meetProvider: s.meetProvider,
        }}
        maintenance={s.maintenanceMode}
        isOwner={admin.role === "owner"}
      />
    </>
  );
}
