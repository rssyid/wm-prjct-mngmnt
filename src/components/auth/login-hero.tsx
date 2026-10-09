import React from "react";

export function LoginHero() {
  return (
    <div className="relative hidden lg:flex items-center justify-center overflow-hidden bg-[#F4F6F4] dark:bg-[#07111E] p-12 select-none border-l border-slate-200/80 dark:border-slate-800">
      {/* Background ambient lighting & soft glow */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-primary/10 dark:bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[360px] h-[360px] bg-sky-500/10 dark:bg-sky-500/5 rounded-full blur-3xl" />
      </div>

      {/* Center artwork: Minimalist hemisphere with frosted glass reflection (pure visual, no text) */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        <div className="relative flex flex-col items-center justify-center">
          {/* Upper Hemisphere (Sun / Dome) */}
          <div className="relative w-64 h-32 overflow-hidden rounded-t-full bg-gradient-to-b from-[#22C55E] to-[#16A34A] shadow-md shadow-emerald-500/20" />

          {/* Horizon divide line */}
          <div className="w-80 h-[1px] bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent" />

          {/* Frosted reflection below horizon */}
          <div className="relative w-64 h-32 overflow-hidden rounded-b-full">
            <div className="w-full h-full bg-gradient-to-t from-transparent via-[#16A34A]/40 to-[#22C55E]/60 blur-lg transform scale-y-[-1]" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#F4F6F4]/50 to-[#F4F6F4] dark:via-[#07111E]/50 dark:to-[#07111E]" />
          </div>

          {/* Frosted glass bar right over the horizon line */}
          <div className="absolute top-[118px] w-72 h-10 rounded-2xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-white/50 dark:border-slate-700/30 shadow-sm" />
        </div>
      </div>
    </div>
  );
}
