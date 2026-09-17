"use client";

import { useEffect, useState } from "react";
import { REFERRAL } from "@/lib/plans";

type Status = { code: string | null; friends: number; towardNext: number; rewardsEarned: number; maxedOut: boolean; plusTrialUntil: string | null };

/** "Invite 2 friends, unlock 14 days of Plus": share link, progress, and any unlocked trial. */
export function InviteFriends({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/referrals")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => null);
  }, []);

  if (!status?.code) return null;
  const link = `${window.location.origin}/r/${status.code}`;
  const share = async () => {
    const text = `I've been using LumoTutor to actually understand my lectures. Join with my link: ${link}`;
    if (navigator.share) {
      await navigator.share({ title: "LumoTutor", text, url: link }).catch(() => null);
      return;
    }
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className={`rounded-3xl border-2 border-dashed border-pen/40 bg-[#fff7ef] ${compact ? "p-4" : "p-5"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-pen">Learn together, free</p>
      <h2 className={`${compact ? "text-base" : "text-lg"} mt-1 font-semibold`}>
        Invite {REFERRAL.friendsNeeded} friends, unlock {REFERRAL.rewardDays} days of Plus
      </h2>
      {status.plusTrialUntil && (
        <p className="mt-1 text-sm font-medium text-green-800">
          🎉 Plus unlocked until {new Date(status.plusTrialUntil).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </p>
      )}
      {!status.maxedOut && (
        <div className="mt-3 flex items-center gap-2" aria-label={`${status.towardNext} of ${REFERRAL.friendsNeeded} friends joined`}>
          {Array.from({ length: REFERRAL.friendsNeeded }, (_, i) => (
            <span key={i} className={`grid h-8 w-8 place-items-center rounded-full border-2 text-sm ${i < status.towardNext ? "border-pen bg-pen text-white" : "border-dashed border-ink/25 text-ink/40"}`}>
              {i < status.towardNext ? "✓" : "+"}
            </span>
          ))}
          <span className="text-sm text-muted">
            {status.towardNext}/{REFERRAL.friendsNeeded} friends joined
          </span>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 text-sm">{link}</code>
        <button onClick={share} className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white">
          {copied ? "Copied!" : "Share link"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">Drop it in your class Discord, GroupMe or group chat. A friend counts once they create an account.</p>
    </section>
  );
}
