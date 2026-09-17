import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 shadow-sm">
        <h1 className="font-hand text-4xl">VideoTutor</h1>
        <p className="mt-1 text-sm text-muted">Sign in to save your videos and questions.</p>
        {error && <p className="mt-4 text-sm text-red-600">Sign-in failed. Please try again.</p>}
        <LoginForm next={typeof next === "string" ? next : "/library"} />
      </div>
    </main>
  );
}
