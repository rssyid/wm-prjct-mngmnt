import { LoginForm } from "@/components/auth/login-form";
import { LoginHero } from "@/components/auth/login-hero";
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
    <main className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 bg-background">
      <section className="flex flex-col justify-center w-full">
        <Suspense
          fallback={
            <div className="w-full max-w-md mx-auto p-8 text-center text-slate-500">
              Memuat formulir masuk...
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </section>

      <LoginHero />
    </main>
  );
}
