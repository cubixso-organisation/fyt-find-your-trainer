import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { ROLE_LABEL } from "@/lib/rbac";
import { findInvite } from "./actions";
import { AcceptForm } from "./accept-form";

export const metadata = { title: "Accept invite" };

export default async function AcceptInvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const invite = await findInvite(token);
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-paper px-5 py-12">
      <div className="w-full max-w-[400px] animate-rise">
        {invite ? (
          <>
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">Operator invite</p>
            <h1 className="mt-2 font-display text-[26px] font-semibold tracking-tight text-ink">Welcome, {invite.name.split(" ")[0]}</h1>
            <p className="mt-2 text-sm text-ink-2">
              You were invited as <span className="font-medium text-ink">{ROLE_LABEL[invite.role]}</span>. Set a password for{" "}
              <span className="num text-ink">{invite.email}</span> to finish.
            </p>
            <AcceptForm token={token} email={invite.email} />
          </>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <span className="grid size-10 place-items-center rounded-[10px] border border-line bg-sunken text-ink-2">
              <LinkIcon className="size-5" strokeWidth={1.5} aria-hidden />
            </span>
            <h1 className="font-display text-xl font-semibold tracking-tight text-ink">This invite link doesn&apos;t work</h1>
            <p className="text-sm text-ink-2">It may have been used already or withdrawn. Ask the super admin who invited you for a new link.</p>
            <Link href="/login" className="text-sm font-medium text-ink underline decoration-line-strong underline-offset-4">Go to sign in</Link>
          </div>
        )}
      </div>
    </main>
  );
}
