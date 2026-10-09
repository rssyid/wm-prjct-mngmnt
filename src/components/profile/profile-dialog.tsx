"use client";

import * as React from "react";
import { Check, Sparkles, User as UserIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  AVAILABLE_AVATAR_STYLES,
  DicebearStyle,
  getDicebearAvatarUrl,
  saveAvatarStyle,
} from "@/lib/avatar";
import { cn } from "@/lib/utils";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
  currentStyle: DicebearStyle;
  onStyleSelect: (style: DicebearStyle) => void;
}

export function ProfileDialog({
  open,
  onOpenChange,
  user,
  currentStyle,
  onStyleSelect,
}: ProfileDialogProps) {
  const seed = user?.name || user?.email || "user";

  const handleSelect = (style: DicebearStyle) => {
    saveAvatarStyle(style);
    onStyleSelect(style);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserIcon className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Profil Pengguna & Avatar
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Sesuaikan tampilan gaya avatar Dicebear untuk akun Anda.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* User details card */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm text-foreground">
              {user?.name || "Pengguna"}
            </span>
            <Badge className="text-[10px] font-mono bg-primary/10 text-primary border-primary/20">
              {user?.role || "USER"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            {user?.email || "email@perusahaan.com"}
          </p>
        </div>

        {/* Avatar style selection grid */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Pilih Gaya Avatar Dicebear
            </span>
            <span className="text-[11px] text-muted-foreground">
              4 Gaya Tersedia
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {AVAILABLE_AVATAR_STYLES.map((style) => {
              const isSelected = currentStyle === style.id;
              const avatarUrl = getDicebearAvatarUrl(seed, style.id);

              return (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => handleSelect(style.id)}
                  className={cn(
                    "group relative flex flex-col items-center p-3 rounded-xl border text-center transition-all duration-150 cursor-pointer select-none",
                    isSelected
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                      : "border-slate-200 dark:border-slate-800 bg-background hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                  )}
                >
                  {/* Selected check badge */}
                  {isSelected && (
                    <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                  )}

                  {/* Avatar preview */}
                  <div className="h-14 w-14 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 p-0.5 mb-2 shadow-xs group-hover:scale-105 transition-transform">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatarUrl}
                      alt={style.label}
                      className="h-full w-full object-cover rounded-full"
                      loading="lazy"
                    />
                  </div>

                  {/* Style info */}
                  <span className="font-semibold text-xs text-foreground">
                    {style.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                    {style.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
