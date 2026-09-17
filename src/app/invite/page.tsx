import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { InviteFriends } from "@/components/invite-friends";
import { REFERRAL } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Invite friends" };

export default async function InvitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/invite");

  return (
    <main className="graph-paper min-h-dvh text-ink">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <AppNav current="/invite" />
        <div className="mx-auto mt-10 max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Learn together, free.</h1>
          <p className="mt-2 text-lg text-ink/70">
            Invite {REFERRAL.friendsNeeded} friends to LumoTutor and unlock {REFERRAL.rewardDays} days of Plus.
          </p>
          <div className="mt-6">
            <InviteFriends />
          </div>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ["1", "Share your link", "Post it in your class Discord, GroupMe, or send it to a study partner."],
              ["2", `${REFERRAL.friendsNeeded} friends sign up`, "A friend counts as soon as they create their LumoTutor account from your link."],
              ["3", `Plus unlocks`, `You get ${REFERRAL.rewardDays} days of Plus automatically: voice tutoring, full practice, exam prep. Up to ${REFERRAL.maxRewards} times.`],
            ].map(([n, title, body]) => (
              <li key={n} className="rounded-2xl border border-ink/10 bg-white p-4">
                <span className="text-sm font-semibold text-pen">Step {n}</span>
                <p className="mt-1 font-semibold">{title}</p>
                <p className="mt-1 text-sm text-ink/70">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </main>
  );
}
