"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User as UserIcon } from "lucide-react";
import { signOut } from "next-auth/react";
import {
  AVATAR_STYLE_CHANGE_EVENT,
  DicebearStyle,
  getDicebearAvatarUrl,
  getSavedAvatarStyle,
} from "@/lib/avatar";
import { ProfileDialog } from "@/components/profile/profile-dialog";

interface UserNavProps {
  user?: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
}

export function UserNav({ user }: UserNavProps) {
  const [avatarStyle, setAvatarStyle] = useState<DicebearStyle>("thumbs");
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    setAvatarStyle(getSavedAvatarStyle());

    const handleStyleChange = (e: Event) => {
      const customEvent = e as CustomEvent<DicebearStyle>;
      if (customEvent.detail) {
        setAvatarStyle(customEvent.detail);
      }
    };

    window.addEventListener(AVATAR_STYLE_CHANGE_EVENT, handleStyleChange);
    return () => {
      window.removeEventListener(AVATAR_STYLE_CHANGE_EVENT, handleStyleChange);
    };
  }, []);

  const getInitials = (name?: string | null) => {
    if (!name) return "WM";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleLogout = async () => {
    await signOut({ redirect: false });
    window.location.href = "/login";
  };

  const avatarUrl = getDicebearAvatarUrl(
    user?.name || user?.email || "user",
    avatarStyle
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative h-9 w-9 rounded-full ring-offset-background transition-colors hover:ring-2 hover:ring-primary/20"
          >
            <Avatar className="h-9 w-9 border border-slate-200 dark:border-slate-800">
              <AvatarImage
                src={avatarUrl}
                alt={user?.name || "Avatar"}
                className="object-cover"
              />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-semibold leading-none text-foreground">
                {user?.name || "Pengguna"}
              </p>
              <p className="text-xs leading-none text-muted-foreground truncate">
                {user?.email || "email@perusahaan.com"}
              </p>
              <div className="pt-1">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-primary/10 text-primary">
                  {user?.role || "USER"}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => setIsProfileOpen(true)}
              className="cursor-pointer"
            >
              <UserIcon className="mr-2 h-4 w-4" />
              <span>Profil Pengguna & Avatar</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Keluar dari Akun</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProfileDialog
        open={isProfileOpen}
        onOpenChange={setIsProfileOpen}
        user={user}
        currentStyle={avatarStyle}
        onStyleSelect={setAvatarStyle}
      />
    </>
  );
}
