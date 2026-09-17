import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error, invited } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">LumoTutor</h1>
        <p className="mt-1 text-sm text-muted">Sign in to save your videos and questions.</p>
        {invited && <p className="mt-4 rounded-lg bg-[#fff1b8] px-3 py-2 text-sm">A friend invited you to LumoTutor. Create your free account to join them.</p>}
        {error && <p className="mt-4 text-sm text-red-600">Sign-in failed. Please try again.</p>}
        <LoginForm next={typeof next === "string" ? next : "/home"} />
      </div>
    </main>
  );
}
