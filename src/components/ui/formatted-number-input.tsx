"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface FormattedNumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  /** Nilai numerik mentah (bisa number, string angka, atau null/undefined) */
  value?: number | string | null;
  /** Callback saat nilai berubah, mengembalikan angka murni atau null bila kosong */
  onChange?: (value: number | null) => void;
  /** Teks prefix, misal "Rp " */
  prefix?: string;
  /** Teks suffix, misal " unit", " %", dll */
  suffix?: string;
  /** Apakah memperbolehkan desimal (default: false) */
  allowDecimals?: boolean;
  /** Jumlah maksimal digit desimal jika allowDecimals = true (default: 2) */
  maxDecimals?: number;
  /** Apakah otomatis memilih/menyeleksi teks saat input difokuskan (default: true) */
  selectOnFocus?: boolean;
  /** Apakah otomatis mengosongkan tampilan saat nilai adalah 0 (default: false) */
  emptyOnZero?: boolean;
}

/**
 * Format string angka dengan pemisah ribuan koma (",")
 * Contoh: "1000000" -> "1,000,000"
 */
function formatWithCommas(raw: string, allowDecimals: boolean, maxDecimals: number): string {
  if (!raw) return "";

  // Pisahkan tanda negatif jika ada
  const isNegative = raw.startsWith("-");
  const cleanRaw = raw.replace(/^-/, "");

  if (allowDecimals) {
    const parts = cleanRaw.split(".");
    const intPart = parts[0]?.replace(/\D/g, "") || "";
    let decPart = parts.length > 1 ? parts[1]?.replace(/\D/g, "") : undefined;

    if (decPart !== undefined && maxDecimals > 0) {
      decPart = decPart.slice(0, maxDecimals);
    }

    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const formatted = decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
    return (isNegative ? "-" : "") + formatted;
  }

  const intPart = cleanRaw.replace(/\D/g, "");
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (isNegative ? "-" : "") + formattedInt;
}

/**
 * Komponen Input Angka & Currency dengan pemisah ribuan koma (",")
 * dan penanganan auto-select / strip leading zero pada angka 0 default
 * agar user tidak perlu repot menekan backspace.
 */
export const FormattedNumberInput = React.forwardRef<
  HTMLInputElement,
  FormattedNumberInputProps
>(
  (
    {
      value,
      onChange,
      prefix,
      suffix,
      allowDecimals = false,
      maxDecimals = 2,
      selectOnFocus = true,
      emptyOnZero = false,
      className,
      placeholder = "0",
      disabled,
      onFocus,
      onKeyDown,
      ...restProps
    },
    ref
  ) => {
    const innerRef = React.useRef<HTMLInputElement | null>(null);

    // Hitung tampilan awal dari prop `value`
    const getFormattedValue = React.useCallback(
      (val: number | string | null | undefined): string => {
        if (val === null || val === undefined || val === "") return "";
        const num = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, ""));
        if (isNaN(num)) return "";
        if (num === 0 && emptyOnZero) return "";
        return formatWithCommas(String(num), allowDecimals, maxDecimals);
      },
      [allowDecimals, maxDecimals, emptyOnZero]
    );

    const [displayValue, setDisplayValue] = React.useState<string>(() =>
      getFormattedValue(value)
    );

    // Sinkronisasi saat prop `value` berubah dari luar (misal form reset atau update data)
    React.useEffect(() => {
      const formatted = getFormattedValue(value);
      setDisplayValue(formatted);
    }, [value, getFormattedValue]);

    // Gabungkan ref luar dan innerRef
    React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      if (selectOnFocus) {
        // Auto select seluruh teks saat fokus agar pengetikan baru langsung menimpa angka 0
        e.target.select();
      }
      onFocus?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const rawText = input.value;

      // Hapus karakter koma sebelum diproses
      let sanitized = rawText.replace(/,/g, "");

      if (!allowDecimals) {
        sanitized = sanitized.replace(/[^\d-]/g, "");
        // Hapus leading zero jika diikuti angka lain (contoh: "05" -> "5")
        if (/^-?0\d+/.test(sanitized)) {
          sanitized = sanitized.replace(/^(-?)0+/, "$1");
        }
      } else {
        // Izinkan satu titik desimal
        const parts = sanitized.split(".");
        let intPart = parts[0]?.replace(/[^\d-]/g, "") || "";
        if (/^-?0\d+/.test(intPart)) {
          intPart = intPart.replace(/^(-?)0+/, "$1");
        }
        const decPart =
          parts.length > 1
            ? parts.slice(1).join("").replace(/[^\d]/g, "")
            : undefined;
        sanitized = decPart !== undefined ? `${intPart}.${decPart}` : intPart;
      }

      if (sanitized === "" || sanitized === "-") {
        setDisplayValue(sanitized);
        onChange?.(null);
        return;
      }

      // Simpan posisi digit sebelum kursor untuk menjaga posisi kursor stabil setelah formatting
      const cursorPosition = input.selectionStart ?? rawText.length;
      const digitsBeforeCursor = (
        rawText.slice(0, cursorPosition).match(/\d/g) || []
      ).length;

      const newFormatted = formatWithCommas(sanitized, allowDecimals, maxDecimals);
      setDisplayValue(newFormatted);

      // Hitung numeric value untuk dikirim ke parent/onChange
      const numericVal = parseFloat(sanitized);
      onChange?.(isNaN(numericVal) ? null : numericVal);

      // Kembalikan posisi kursor agar tidak melompat ke paling belakang
      requestAnimationFrame(() => {
        if (!innerRef.current) return;
        let targetCursor = 0;
        let count = 0;
        for (let i = 0; i < newFormatted.length; i++) {
          if (/\d/.test(newFormatted[i])) {
            count++;
          }
          if (count >= digitsBeforeCursor) {
            targetCursor = i + 1;
            break;
          }
        }
        if (count < digitsBeforeCursor) {
          targetCursor = newFormatted.length;
        }
        innerRef.current.setSelectionRange(targetCursor, targetCursor);
      });
    };

    return (
      <div className="relative flex items-center w-full">
        {prefix && (
          <span className="absolute left-3 text-xs font-medium text-muted-foreground select-none pointer-events-none z-10">
            {prefix}
          </span>
        )}
        <input
          ref={innerRef}
          type="text"
          inputMode={allowDecimals ? "decimal" : "numeric"}
          autoComplete="off"
          value={displayValue}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={handleFocus}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors",
            "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            "tabular-nums text-right font-medium",
            prefix && "pl-9",
            suffix && "pr-9",
            className
          )}
          {...restProps}
        />
        {suffix && (
          <span className="absolute right-3 text-xs font-medium text-muted-foreground select-none pointer-events-none z-10">
            {suffix}
          </span>
        )}
      </div>
    );
  }
);

FormattedNumberInput.displayName = "FormattedNumberInput";
