"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoginInput, loginSchema } from "@/lib/validations/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
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

  return (
    <Card className="w-full max-w-md shadow-lg border-slate-200">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
          WM PRJCT MNGMNT
        </CardTitle>
        <CardDescription className="text-sm text-slate-500">
          Masuk ke akun Anda untuk mengelola proyek Water Management
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {errorMessage && (
            <div className="p-3 text-sm rounded-md bg-destructive/15 text-destructive font-medium border border-destructive/20">
              {errorMessage}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="nama@perusahaan.com"
              autoComplete="email"
              disabled={isLoading}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Kata Sandi</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={isLoading}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="pt-2">
          <Button type="submit" className="w-full font-semibold" disabled={isLoading}>
            {isLoading ? "Memproses..." : "Masuk"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
