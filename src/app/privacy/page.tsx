import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { SITE } from "@/lib/site";

export const metadata = { title: "Privacy Policy", description: "What LumoTutor collects, why, and how to delete it." };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        Short version: we store what we need to teach you, we don&apos;t sell it, and you can delete all of it from{" "}
        <Link href="/settings">Settings</Link> at any time.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account</strong>: your email address, and a password hash if you set one. Payment details are handled by Stripe — we never see your
          card number.
        </li>
        <li>
          <strong>What you add</strong>: lecture links, uploaded syllabi, slides, notes, homework and quizzes, photos of your work, and anything you
          draw on the whiteboard or write on a page.
        </li>
        <li>
          <strong>Your learning</strong>: the questions you ask, Lumo&apos;s replies, practice attempts, and the derived model of what you know — concepts,
          mastery estimates and misconceptions.
        </li>
        <li>
          <strong>Technical</strong>: basic logs and usage counts (how many questions today, which model answered) for limits, billing and debugging.
        </li>
      </ul>

      <h2>Why we use it</h2>
      <p>
        To run the service you asked for: answering your questions about a specific moment in a lecture, building your course map from your syllabus,
        choosing your next practice problem, and enforcing plan limits. Your learning history is what makes the tutor adapt to you rather than start
        from zero every session.
      </p>

      <h2>Who it goes to</h2>
      <ul>
        <li>
          <strong>Google (Gemini API)</strong>: the content needed to answer a question — the video moment, page image, your drawing and the question
          itself. Google processes it to return an answer.
        </li>
        <li>
          <strong>Supabase</strong>: our database, authentication and file storage.
        </li>
        <li>
          <strong>Vercel</strong>: hosting.
        </li>
        <li>
          <strong>Stripe</strong>: payments, if you subscribe.
        </li>
      </ul>
      <p>
        We do not sell your data, and we do not use your coursework to train our own models. Beyond these providers, we share data only when the law
        requires it.
      </p>

      <h2>How long we keep it</h2>
      <p>
        As long as your account exists. Paused-frame images and drawings sent with questions are kept with the conversation they belong to. Delete your
        account and we remove your profile, sessions, messages, uploads, learning model and stored files. Backups roll off within 30 days. We keep
        billing records where tax law requires it.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>
          <strong>Export</strong>: download everything we hold about you as JSON from <Link href="/settings">Settings</Link>.
        </li>
        <li>
          <strong>Delete</strong>: delete your account from Settings. It happens immediately and cannot be undone.
        </li>
        <li>
          <strong>Ask</strong>: email <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a> and we&apos;ll answer questions about your data.
        </li>
      </ul>
      <p>
        If you are in the EU or UK, you have rights to access, correct, export and erase your data; the tools above cover them, and email reaches us for
        anything they don&apos;t.
      </p>

      <h2>Students under 18</h2>
      <p>
        {SITE.name} is for students 13 and older. We don&apos;t knowingly collect data from children under 13. If you believe a younger child has an account,
        email us and we&apos;ll delete it.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit and at rest by our providers, uploads live in private storage reachable only through short-lived signed links, and
        database access is restricted per user at the row level. No system is perfect; if we ever have a breach affecting you, we&apos;ll tell you.
      </p>

      <h2>Changes</h2>
      <p>
        We&apos;ll post changes here and update the date above. Material changes come with an email or an in-app notice. Questions:{" "}
        <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>.
      </p>
    </LegalPage>
  );
}
