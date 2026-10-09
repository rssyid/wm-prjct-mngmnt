"use client";

import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";
import { useState } from "react";

export function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    await signOut({ redirect: false });
    window.location.href = "/login";
  };

  return (
    <Button
      variant="outline"
      onClick={handleLogout}
      disabled={isLoading}
      className="text-slate-700 hover:text-slate-900 border-slate-300"
    >
      {isLoading ? "Keluar..." : "Keluar dari Akun"}
    </Button>
  );
}
