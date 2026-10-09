"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Copy, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LoginInput, loginSchema } from "@/lib/validations/auth";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const rememberMeValue = watch("rememberMe");

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        rememberMe: String(Boolean(data.rememberMe)),
        redirect: false,
      });

      if (!result?.ok) {
        if (result?.status === 429) {
          setErrorMessage(
            "Terlalu banyak percobaan masuk. Silakan coba lagi dalam 5 menit."
          );
        } else {
          setErrorMessage("Email atau kata sandi tidak sesuai. Silakan periksa kembali.");
        }
        setIsLoading(false);
        return;
      }

      router.replace(callbackUrl);
      router.refresh();
    } catch {
      setErrorMessage("Terjadi kesalahan pada sistem. Silakan coba beberapa saat lagi.");
      setIsLoading(false);
    }
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText("admin.wm@perusahaan.com");
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Fallback silent
    }
  };

  return (
    <div className="flex flex-col justify-between min-h-screen p-8 sm:p-12 lg:p-16 max-w-xl mx-auto w-full">
      {/* Brand logo top-left */}
      <div className="flex items-center gap-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/20" />
        <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 uppercase">
          WM PRJCT MNGMNT
        </span>
      </div>

      {/* Main form container */}
      <div className="my-auto py-10 w-full max-w-md mx-auto">
        <div className="space-y-2 mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Selamat datang kembali
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Silakan masukkan detail akun Anda untuk mengakses sistem.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {errorMessage && (
            <div className="p-3.5 text-sm rounded-lg bg-destructive/10 text-destructive font-medium border border-destructive/20 animate-in fade-in-50 duration-200">
              {errorMessage}
            </div>
          )}

          {/* Email input */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="nama@perusahaan.com"
              autoComplete="email"
              disabled={isLoading}
              className="h-11 border-slate-300 dark:border-slate-700 focus-visible:ring-primary/30"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive font-medium">{errors.email.message}</p>
            )}
          </div>

          {/* Password input with toggle visibility */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Kata Sandi
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={isLoading}
                className="h-11 pr-11 border-slate-300 dark:border-slate-700 focus-visible:ring-primary/30"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none transition-colors"
                aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive font-medium">{errors.password.message}</p>
            )}
          </div>

          {/* Remember me row */}
          <div className="flex items-center space-x-2 pt-1">
            <Checkbox
              id="rememberMe"
              checked={rememberMeValue}
              onCheckedChange={(checked) =>
                setValue("rememberMe", checked, {
                  shouldValidate: true,
                  shouldDirty: true,
                  shouldTouch: true,
                })
              }
              disabled={isLoading}
            />
            <Label
              htmlFor="rememberMe"
              className="text-sm font-normal text-slate-600 dark:text-slate-400 cursor-pointer select-none"
            >
              Ingat saya selama 30 hari
            </Label>
          </div>

          {/* Submit CTA */}
          <Button
            type="submit"
            className="w-full h-11 font-semibold text-base shadow-sm transition-all duration-150"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memproses...
              </span>
            ) : (
              "Masuk"
            )}
          </Button>

          {/* Footer note: Super admin help (Option 2 - Minimalist) */}
          <div className="pt-4 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Kendala akses atau lupa kata sandi?{" "}
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="font-semibold text-primary hover:text-primary/80 hover:underline transition-colors focus:outline-none"
                  >
                    Hubungi Super Admin
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <DialogTitle className="text-center text-lg font-bold">
                      Bantuan Akses & Pemulihan Akun
                    </DialogTitle>
                    <DialogDescription className="text-center text-sm text-slate-500 pt-1">
                      Sesuai protokol keamanan sistem operasional WM PRJCT MNGMNT,
                      pembuatan akun dan reset kata sandi dikelola secara terpusat oleh Administrator.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-3.5 my-2 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm">
                    <div>
                      <div className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1">
                        Kontak Administrator
                      </div>
                      <div className="flex items-center justify-between font-mono text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800">
                        <span>admin.wm@perusahaan.com</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={handleCopyEmail}
                        >
                          {isCopied ? (
                            <span className="flex items-center text-primary">
                              <Check className="h-3 w-3 mr-1" /> Tersalin
                            </span>
                          ) : (
                            <span className="flex items-center text-slate-600 dark:text-slate-400">
                              <Copy className="h-3 w-3 mr-1" /> Salin
                            </span>
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Silakan sertakan nama lengkap, divisi, dan deskripsi kendala saat menghubungi tim Super Admin WM HO.
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </p>
          </div>
        </form>
      </div>

      {/* Footer copyright */}
      <div className="w-full text-left text-xs text-slate-400 dark:text-slate-500">
        © 2026 WM PRJCT MNGMNT. Hak cipta dilindungi.
      </div>
    </div>
  );
}
