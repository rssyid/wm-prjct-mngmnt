import React from "react";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";

export function LoginHero() {
  return (
    <div className="relative hidden lg:flex items-center justify-center overflow-hidden bg-[#F4F6F4] dark:bg-[#07111E] p-12 xl:p-16 select-none border-l border-slate-200/80 dark:border-slate-800">
      {/* Background ambient lighting & soft glow */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-primary/10 dark:bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[360px] h-[360px] bg-sky-500/10 dark:bg-sky-500/5 rounded-full blur-3xl" />
      </div>

      {/* Animated Text Quotes Container */}
      <div className="relative z-10 w-full max-w-xl flex items-center justify-center px-4">
        <TextGenerateEffect />
      </div>
    </div>
  );
}
