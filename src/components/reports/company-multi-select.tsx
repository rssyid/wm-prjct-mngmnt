"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Building2, Check, ChevronsUpDown, RotateCcw, Search, X } from "lucide-react";
import React, { useMemo, useState } from "react";

export interface CompanyWithRegion {
  id: string;
  code: string;
  name: string;
  region?: {
    id: string;
    code: string;
    name: string;
  } | null;
}

interface CompanyMultiSelectFilterProps {
  companies: CompanyWithRegion[];
  selectedCompanyIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function CompanyMultiSelectFilter({
  companies,
  selectedCompanyIds,
  onChange,
  disabled = false,
  className,
  placeholder = "Pilih Perusahaan",
}: CompanyMultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Grouping companies by region
  const groupedCompanies = useMemo(() => {
    const map = new Map<string, CompanyWithRegion[]>();
    const query = search.trim().toLowerCase();

    for (const company of companies) {
      if (
        query &&
        !company.name.toLowerCase().includes(query) &&
        !company.code.toLowerCase().includes(query) &&
        !(company.region?.name.toLowerCase().includes(query) ?? false)
      ) {
        continue;
      }

      const regionKey = company.region?.name || "Wilayah Lainnya / Tanpa Region";
      if (!map.has(regionKey)) {
        map.set(regionKey, []);
      }
      map.get(regionKey)!.push(company);
    }

    // Sort regions alphabetically
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [companies, search]);

  const isAllSelected =
    companies.length > 0 && selectedCompanyIds.length === companies.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      onChange([]);
    } else {
      onChange(companies.map((c) => c.id));
    }
  };

  const toggleCompany = (id: string) => {
    if (selectedCompanyIds.includes(id)) {
      onChange(selectedCompanyIds.filter((item) => item !== id));
    } else {
      onChange([...selectedCompanyIds, id]);
    }
  };

  const toggleRegion = (regionCompanies: CompanyWithRegion[]) => {
    const regionIds = regionCompanies.map((c) => c.id);
    const allRegionSelected = regionIds.every((id) =>
      selectedCompanyIds.includes(id)
    );

    if (allRegionSelected) {
      // Uncheck all in this region
      onChange(selectedCompanyIds.filter((id) => !regionIds.includes(id)));
    } else {
      // Check all in this region
      const newIds = new Set([...selectedCompanyIds, ...regionIds]);
      onChange(Array.from(newIds));
    }
  };

  // Label display
  const triggerLabel = useMemo(() => {
    if (selectedCompanyIds.length === 0 || isAllSelected) {
      return placeholder;
    }
    if (selectedCompanyIds.length === 1) {
      const match = companies.find((c) => c.id === selectedCompanyIds[0]);
      return match ? match.name : "1 Perusahaan Terpilih";
    }
    return `${selectedCompanyIds.length} Perusahaan Terpilih`;
  }, [selectedCompanyIds, isAllSelected, companies, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-9 justify-between text-left font-normal border-input bg-background hover:bg-accent/50",
            className
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{triggerLabel}</span>
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            {selectedCompanyIds.length > 0 && !isAllSelected && (
              <Badge
                variant="secondary"
                className="h-5 px-1.5 text-[10px] font-semibold bg-primary/10 text-primary border-primary/20"
              >
                {selectedCompanyIds.length}
              </Badge>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 shadow-lg border-border"
        align="start"
      >
        <div className="p-2 border-b border-border space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Cari perusahaan atau region..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between text-xs px-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleSelectAll}
              className="h-6 px-1.5 text-xs text-primary hover:text-primary/90 font-medium"
            >
              {isAllSelected ? "Hapus Semua" : "Pilih Semua"}
            </Button>
            {selectedCompanyIds.length > 0 && !isAllSelected && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange([])}
                className="h-6 px-1.5 text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto p-1 text-xs divide-y divide-border/40">
          {groupedCompanies.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">
              Perusahaan tidak ditemukan.
            </div>
          ) : (
            groupedCompanies.map(([regionName, regionList]) => {
              const allRegionChecked = regionList.every((c) =>
                selectedCompanyIds.includes(c.id)
              );
              const someRegionChecked =
                regionList.some((c) => selectedCompanyIds.includes(c.id)) &&
                !allRegionChecked;

              return (
                <div key={regionName} className="py-1">
                  {/* Region Group Header */}
                  <div
                    onClick={() => toggleRegion(regionList)}
                    className="flex items-center justify-between px-2 py-1.5 rounded-sm bg-muted/50 hover:bg-muted cursor-pointer font-medium text-foreground select-none mb-1 text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors",
                          allRegionChecked
                            ? "bg-primary border-primary text-primary-foreground"
                            : someRegionChecked
                            ? "bg-primary/20 border-primary text-primary"
                            : "border-muted-foreground/30 bg-background"
                        )}
                      >
                        {allRegionChecked && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                        {someRegionChecked && (
                          <div className="w-1.5 h-1.5 bg-primary rounded-xs" />
                        )}
                      </div>
                      <span>{regionName}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {regionList.filter((c) => selectedCompanyIds.includes(c.id)).length} / {regionList.length}
                    </span>
                  </div>

                  {/* Company items in region */}
                  <div className="space-y-0.5 pl-2">
                    {regionList.map((company) => {
                      const isChecked = selectedCompanyIds.includes(company.id);
                      return (
                        <div
                          key={company.id}
                          onClick={() => toggleCompany(company.id)}
                          className={cn(
                            "flex items-center justify-between px-2 py-1.5 rounded cursor-pointer hover:bg-accent/60 transition-colors select-none",
                            isChecked && "bg-primary/5 font-medium"
                          )}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <div
                              className={cn(
                                "w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors",
                                isChecked
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-muted-foreground/30 bg-background"
                              )}
                            >
                              {isChecked && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                            </div>
                            <span className="truncate">{company.name}</span>
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground shrink-0 ml-1">
                            {company.code}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-2 border-t border-border bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Total PT: {companies.length}</span>
          <span>
            {selectedCompanyIds.length === 0
              ? "Semua dipilih"
              : `${selectedCompanyIds.length} dipilih`}
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
