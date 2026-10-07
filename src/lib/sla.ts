import { ProjectStatus, StatusIndicator } from "@prisma/client";

/**
 * Format Date ke string YYYY-MM-DD berbasis UTC untuk perbandingan kalender tanggal murni
 * tanpa terdistorsi oleh offset zona waktu lokal.
 */
export function toCalendarDateString(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Normalisasi Date ke objek Date di awal hari (00:00:00.000 UTC).
 */
export function normalizeUtcDate(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export interface SlaCalculationParams {
  status: ProjectStatus;
  currentIndicator?: StatusIndicator | null;
  progressPct: number;
  targetStartDate?: Date | string | null;
  targetEndDate?: Date | string | null;
  holidays?: Array<Date | string>;
  asOfDate?: Date | string;
}

export interface SlaCalculationResult {
  indicator: StatusIndicator;
  plannedPct: number;
  actualPct: number;
  deviation: number;
  totalWorkingDays: number;
  elapsedWorkingDays: number;
  isPastDeadline: boolean;
}

/**
 * Menghitung jumlah hari kerja antara dua tanggal (inklusif):
 * Hari kerja = Hari kalender − Hari Libur (tabel Holiday) − Hari Minggu.
 * Hari Sabtu DIHITUNG sebagai hari kerja.
 *
 * Catatan: Jika libur nasional jatuh pada hari Minggu, tidak dihitung ganda.
 */
export function countWorkingDays(
  startDate: Date | string,
  endDate: Date | string,
  holidaySet: Set<string>
): number {
  const start = normalizeUtcDate(startDate);
  const end = normalizeUtcDate(endDate);

  if (start.getTime() > end.getTime()) {
    return 0;
  }

  let workingDays = 0;
  const current = new Date(start.getTime());

  while (current.getTime() <= end.getTime()) {
    const dayOfWeek = current.getUTCDay(); // 0 = Minggu, 6 = Sabtu
    const dateStr = toCalendarDateString(current);

    // Hari Minggu bukan hari kerja
    if (dayOfWeek !== 0) {
      // Jika hari Senin s.d. Sabtu, bukan hari libur maka dihitung hari kerja
      if (!holidaySet.has(dateStr)) {
        workingDays++;
      }
    }

    // Maju 1 hari
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return workingDays;
}

/**
 * SATU tempat kalkulasi SLA & status early warning (EWS):
 * Sesuai docs/WORKFLOW.md §4 & aturan baku sistem:
 * 1. COMPLETED bila status COMPLETED.
 * 2. ON_HOLD dibekukan (menggunakan statusIndicator yang sedang aktif).
 * 3. DELAYED bila targetEndDate lewat ATAU deviasi > 25 poin.
 * 4. AT_RISK bila deviasi > 10 poin.
 * 5. ON_TRACK bila tidak memenuhi kondisi di atas.
 *
 * Deviasi = Rencana Linear (%) − Progres Aktual (%)
 */
export function calculateProjectSla(params: SlaCalculationParams): SlaCalculationResult {
  const {
    status,
    currentIndicator,
    progressPct = 0,
    targetStartDate,
    targetEndDate,
    holidays = [],
    asOfDate = new Date(),
  } = params;

  // 1. Proyek COMPLETED selalu berindikator COMPLETED
  if (status === ProjectStatus.COMPLETED) {
    return {
      indicator: StatusIndicator.COMPLETED,
      plannedPct: 100,
      actualPct: Math.min(100, Math.max(0, progressPct)),
      deviation: 0,
      totalWorkingDays: 0,
      elapsedWorkingDays: 0,
      isPastDeadline: false,
    };
  }

  // 2. Proyek ON_HOLD dibekukan indikatornya
  if (status === ProjectStatus.ON_HOLD) {
    return {
      indicator: currentIndicator || StatusIndicator.ON_TRACK,
      plannedPct: 0,
      actualPct: Math.min(100, Math.max(0, progressPct)),
      deviation: 0,
      totalWorkingDays: 0,
      elapsedWorkingDays: 0,
      isPastDeadline: false,
    };
  }

  // Jika target tanggal belum ditentukan, fallback ke ON_TRACK
  if (!targetStartDate || !targetEndDate) {
    return {
      indicator: StatusIndicator.ON_TRACK,
      plannedPct: 0,
      actualPct: Math.min(100, Math.max(0, progressPct)),
      deviation: 0,
      totalWorkingDays: 0,
      elapsedWorkingDays: 0,
      isPastDeadline: false,
    };
  }

  // Kumpulkan set string tanggal libur YYYY-MM-DD
  const holidaySet = new Set<string>();
  for (const h of holidays) {
    const s = toCalendarDateString(h);
    if (s) holidaySet.add(s);
  }

  const startUtc = normalizeUtcDate(targetStartDate);
  const endUtc = normalizeUtcDate(targetEndDate);
  const asOfUtc = normalizeUtcDate(asOfDate);

  // Periksa apakah targetEndDate sudah terlewati (hari ini > targetEndDate)
  const isPastDeadline = asOfUtc.getTime() > endUtc.getTime();

  // Hitung total hari kerja rencana
  const totalWorkingDays = countWorkingDays(startUtc, endUtc, holidaySet);

  // Hitung hari kerja terlampaui
  let elapsedWorkingDays = 0;
  if (asOfUtc.getTime() < startUtc.getTime()) {
    elapsedWorkingDays = 0;
  } else if (asOfUtc.getTime() >= endUtc.getTime()) {
    elapsedWorkingDays = totalWorkingDays;
  } else {
    elapsedWorkingDays = countWorkingDays(startUtc, asOfUtc, holidaySet);
  }

  // Hitung persentase rencana linear
  let plannedPct = 0;
  if (totalWorkingDays > 0) {
    plannedPct = Math.min(100, Math.max(0, (elapsedWorkingDays / totalWorkingDays) * 100));
  } else if (isPastDeadline) {
    plannedPct = 100;
  } else {
    plannedPct = 0;
  }

  // Bulatkan 2 desimal
  plannedPct = Math.round(plannedPct * 100) / 100;
  const actualPct = Math.min(100, Math.max(0, Math.round(progressPct * 100) / 100));
  const deviation = Math.round((plannedPct - actualPct) * 100) / 100;

  // Evaluasi indikator EWS
  let indicator: StatusIndicator = StatusIndicator.ON_TRACK;

  if (isPastDeadline || deviation > 25) {
    indicator = StatusIndicator.DELAYED;
  } else if (deviation > 10) {
    indicator = StatusIndicator.AT_RISK;
  } else {
    indicator = StatusIndicator.ON_TRACK;
  }

  return {
    indicator,
    plannedPct,
    actualPct,
    deviation,
    totalWorkingDays,
    elapsedWorkingDays,
    isPastDeadline,
  };
}
