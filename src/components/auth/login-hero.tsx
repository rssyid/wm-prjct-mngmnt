import React from "react";

export function LoginHero() {
  return (
    <div className="relative hidden lg:flex flex-col items-center justify-between overflow-hidden bg-[#F4F6F4] dark:bg-[#07111E] p-12 select-none border-l border-slate-200/80 dark:border-slate-800">
      {/* Background ambient lighting & subtle glow */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-primary/10 dark:bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[360px] h-[360px] bg-sky-500/10 dark:bg-sky-500/5 rounded-full blur-3xl" />
      </div>

      {/* Top subtle badge */}
      <div className="w-full flex justify-end z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/80 backdrop-blur-md text-xs font-medium text-slate-600 dark:text-slate-300 shadow-xs">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          Enterprise Water Management Platform
        </div>
      </div>

      {/* Center artwork: Minimalist horizon graphic with frosted reflection */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto">
        <div className="relative w-72 h-64 flex flex-col items-center justify-center">
          {/* Half circle dome (emerald / water gradient) */}
          <div className="relative w-44 h-22 overflow-hidden rounded-t-full bg-gradient-to-b from-emerald-500 to-primary shadow-lg shadow-emerald-500/15" />

          {/* Horizon divide line */}
          <div className="w-60 h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent my-0" />

          {/* Frosted reflection below horizon */}
          <div className="relative w-44 h-22 overflow-hidden rounded-b-full">
            <div className="w-full h-full bg-gradient-to-t from-transparent via-primary/40 to-emerald-400/60 blur-md transform scale-y-[-1]" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#F4F6F4] dark:to-[#07111E] opacity-75" />
          </div>

          {/* Soft frosted glass pill overlay at horizon */}
          <div className="absolute top-[120px] w-52 h-8 rounded-full bg-white/45 dark:bg-slate-900/40 backdrop-blur-md border border-white/60 dark:border-slate-700/40 shadow-xs" />
        </div>

        {/* Caption under artwork */}
        <div className="text-center mt-4 max-w-sm">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
            Transparan, Terukur & Terintegrasi
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Satu sumber kebenaran untuk perencanaan anggaran, pengadaan logistik, progres mingguan, hingga serah terima proyek.
          </p>
        </div>
      </div>

      {/* Bottom info */}
      <div className="w-full flex justify-between items-center z-10 text-xs text-slate-400 dark:text-slate-500">
        <span>WM PRJCT MNGMNT</span>
        <span>Edisi Operasional 2026</span>
      </div>
    </div>
  );
}
