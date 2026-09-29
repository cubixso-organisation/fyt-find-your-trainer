import { requireViewer } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/primitives";
import { ProfileClient } from "./profile-client";

export const metadata = { title: "Profile & security" };

export default async function ProfilePage() {
  const { admin, permissions } = await requireViewer();
  return (
    <>
      <PageHeader title="Profile & security" description="Your details, your password and where you're signed in." />
      <ProfileClient
        name={admin.name}
        email={admin.email}
        phone={admin.phone ?? ""}
        role={admin.role}
        lastLoginAt={admin.lastLoginAt}
        modules={PERMISSIONS.filter((p) => permissions.has(p.key)).map((p) => p.label)}
      />
    </>
  );
}
