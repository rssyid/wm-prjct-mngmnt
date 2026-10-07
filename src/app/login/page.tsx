import { LoginForm } from "@/components/auth/login-form";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata = {
  title: "Masuk | WM PRJCT MNGMNT",
  description: "Halaman autentikasi sistem manajemen proyek Water Management",
};

export default async function LoginPage() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    redirect("/");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <Suspense
        fallback={
          <div className="w-full max-w-md p-8 text-center text-slate-500">
            Memuat formulir...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
