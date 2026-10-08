"use client";

import { AppShell } from "@/components/layout/app-shell";
import { BoqItem, BoqTemplateEditor } from "@/components/projects/boq-template-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUploadButton } from "@/components/ui/file-upload-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { parseGeoFile } from "@/lib/geo";
import { projectInputSchema, type ProjectInput } from "@/lib/validations/project.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { BudgetType, LocationType } from "@prisma/client";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileUp,
  Layers,
  Loader2,
  Save,
  Trash2,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { useForm } from "react-hook-form";

// Lazy-load MapPicker via next/dynamic dengan ssr: false
const MapPicker = dynamic(() => import("@/components/projects/map-picker"), {
  ssr: false,
  loading: () => (
    <div className="h-[320px] w-full rounded-md border border-border bg-muted/40 flex items-center justify-center text-xs text-muted-foreground animate-pulse">
      Memuat modul peta...
    </div>
  ),
});

interface HierarchyCompany {
  id: string;
  code: string;
  name: string;
  estates: {
    id: string;
    code: string;
    name: string;
    blocks: {
      id: string;
      blockCode: string;
      name: string;
    }[];
  }[];
}

interface MasterStructure {
  id: string;
  name: string;
  variants: {
    id: string;
    code: string;
    name: string;
    defaultBoqItems?: BoqItem[] | null;
  }[];
}

interface MasterCategory {
  id: string;
  code: string;
  name: string;
}

interface MasterUom {
  id: string;
  code: string;
  name: string;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [geoFileLoading, setGeoFileLoading] = useState(false);
  const [geoFileError, setGeoFileError] = useState<string | null>(null);
  const [geoFileInfo, setGeoFileInfo] = useState<{
    name: string;
    featureCount: number;
    geometryType: string;
  } | null>(null);

  // Fetch data referensi master untuk form
  const { data: companiesData } = useQuery<{ success: boolean; data: HierarchyCompany[] }>({
    queryKey: ["master-companies-hierarchy"],
    queryFn: async () => {
      const res = await fetch("/api/master?type=company&include=hierarchy");
      if (!res.ok) throw new Error("Gagal mengambil data perusahaan");
      return res.json();
    },
  });

  const { data: categoriesData } = useQuery<{ success: boolean; data: MasterCategory[] }>({
    queryKey: ["master-categories"],
    queryFn: async () => {
      const res = await fetch("/api/master?type=category");
      if (!res.ok) throw new Error("Gagal mengambil data kategori");
      return res.json();
    },
  });

  const { data: structuresData } = useQuery<{ success: boolean; data: MasterStructure[] }>({
    queryKey: ["master-structures"],
    queryFn: async () => {
      const res = await fetch("/api/master?type=structure");
      if (!res.ok) throw new Error("Gagal mengambil data struktur");
      return res.json();
    },
  });

  const { data: uomsData } = useQuery<{ success: boolean; data: MasterUom[] }>({
    queryKey: ["master-uoms"],
    queryFn: async () => {
      const res = await fetch("/api/master?type=uom");
      if (!res.ok) throw new Error("Gagal mengambil data satuan");
      return res.json();
    },
  });

  const companies = companiesData?.data || [];
  const categories = categoriesData?.data || [];
  const structures = structuresData?.data || [];
  const uoms = uomsData?.data || [];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProjectInput>({
    resolver: zodResolver(projectInputSchema),
    defaultValues: {
      projectName: "",
      displayName: "",
      folderCategoryId: "",
      structureTypeId: "",
      structureVariantId: null,
      companyId: "",
      estateId: "",
      blockId: null,
      locationType: LocationType.POINT,
      budgetType: BudgetType.CAPEX_BUDGETED,
      totalBudgetAmount: 0,
      targetQuantity: null,
      uom: "unit",
      latitude: null,
      longitude: null,
      geoCoordinates: null,
      sitePlanUrl: null,
      drawingUrl: null,
      boqItems: [],
    },
  });

  const selectedCompanyId = watch("companyId");
  const selectedEstateId = watch("estateId");
  const selectedStructureTypeId = watch("structureTypeId");
  const currentLatitude = watch("latitude");
  const currentLongitude = watch("longitude");
  const currentLocationType = watch("locationType");
  const currentGeoCoordinates = watch("geoCoordinates");
  const currentBoqItems = watch("boqItems") || [];

  // Filter cascading
  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);
  const availableEstates = selectedCompany?.estates || [];
  const selectedEstate = availableEstates.find((e) => e.id === selectedEstateId);
  const availableBlocks = selectedEstate?.blocks || [];

  const selectedStructure = structures.find((s) => s.id === selectedStructureTypeId);
  const availableVariants = selectedStructure?.variants || [];

  // Handle upload file GeoJSON / Shapefile ZIP
  const handleGeoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGeoFileError(null);
    setGeoFileLoading(true);

    try {
      const parsed = await parseGeoFile(file);
      setValue("geoCoordinates", parsed.geoJson);
      setValue("locationType", parsed.locationType);
      setValue("latitude", parsed.center.lat);
      setValue("longitude", parsed.center.lng);
      setGeoFileInfo({
        name: parsed.fileName,
        featureCount: parsed.featureCount,
        geometryType: parsed.geometryType,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memproses file spasial";
      setGeoFileError(msg);
    } finally {
      setGeoFileLoading(false);
      e.target.value = "";
    }
  };

  // Handle reset file geometri kembali ke mode titik manual
  const handleClearGeoFile = () => {
    setValue("geoCoordinates", null);
    setValue("locationType", LocationType.POINT);
    setGeoFileInfo(null);
    setGeoFileError(null);
  };

  // Handle auto populate template BOQ saat varian dipilih
  const handleVariantSelect = (variantId: string) => {
    setValue("structureVariantId", variantId);
    const variant = availableVariants.find((v) => v.id === variantId);
    if (variant && Array.isArray(variant.defaultBoqItems) && variant.defaultBoqItems.length > 0) {
      setValue("boqItems", variant.defaultBoqItems);
    }
  };

  const onSubmit = async (values: ProjectInput) => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok || !result.success) {
        let msg = result.error || `Gagal menyimpan proyek baru (HTTP ${res.status})`;
        if (result.details && typeof result.details === "object") {
          const detailMsgs = Object.entries(result.details)
            .map(([field, errs]) => `${field}: ${Array.isArray(errs) ? errs.join(", ") : errs}`)
            .join("; ");
          if (detailMsgs) msg += ` (${detailMsgs})`;
        }
        throw new Error(msg);
      }

      // Berhasil dibuat -> redirect ke halaman detail proyek
      router.push(`/projects/${result.data.id}`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Terjadi kesalahan pada server");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        {/* Header & Back Button */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                <Link href="/projects">
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Kembali ke Daftar
                </Link>
              </Button>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Buat Proyek Baru
            </h2>
            <p className="text-sm text-muted-foreground">
              Formulir inisiasi proyek Water Management. Kode proyek unik akan dihasilkan secara otomatis.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="rounded-md border border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/40 p-4 text-sm text-rose-700 dark:text-rose-400 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Gagal Menyimpan Proyek</p>
              <p className="text-xs mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit, (formErrors) => {
            console.error("Form validation errors:", formErrors);
            const firstError = Object.values(formErrors)[0]?.message;
            setErrorMessage(
              firstError
                ? `Validasi formulir belum lengkap: ${firstError}`
                : "Mohon lengkapi seluruh kolom wajib yang bertanda bintang (*)"
            );
          })}
          className="space-y-6"
        >
          {/* Bagian 1: Identitas & Klasifikasi */}
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">
                1. Identitas & Klasifikasi Proyek
              </CardTitle>
              <CardDescription className="text-xs">
                Informasi dasar penamaan dan kategori folder pekerjaan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="projectName" className="text-xs font-semibold">
                    Nama Proyek <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="projectName"
                    {...register("projectName")}
                    placeholder="Contoh: Pembangunan Pintu Air Sekunder Blok C12"
                    onChange={(e) => {
                      register("projectName").onChange(e);
                      // Auto-fill display name bila masih kosong
                      if (!watch("displayName")) {
                        setValue("displayName", e.target.value);
                      }
                    }}
                  />
                  {errors.projectName && (
                    <p className="text-[11px] text-rose-500">{errors.projectName.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="displayName" className="text-xs font-semibold">
                    Display Name (Nama Pendek / Peta) <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="displayName"
                    {...register("displayName")}
                    placeholder="Contoh: PA-C12 Sekunder"
                  />
                  {errors.displayName && (
                    <p className="text-[11px] text-rose-500">{errors.displayName.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="folderCategoryId" className="text-xs font-semibold">
                    Kategori Proyek <span className="text-rose-500">*</span>
                  </Label>
                  <Select
                    value={watch("folderCategoryId")}
                    onValueChange={(val) => setValue("folderCategoryId", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Kategori Folder" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.code} — {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.folderCategoryId && (
                    <p className="text-[11px] text-rose-500">
                      {errors.folderCategoryId.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="locationType" className="text-xs font-semibold">
                    Tipe Geometri Lokasi
                  </Label>
                  <Select
                    value={watch("locationType")}
                    onValueChange={(val) => setValue("locationType", val as LocationType)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Tipe Lokasi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={LocationType.POINT}>Titik (Point)</SelectItem>
                      <SelectItem value={LocationType.LINE}>Jalur (Line)</SelectItem>
                      <SelectItem value={LocationType.POLYGON}>Area (Polygon)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bagian 2: Lokasi Hierarkis & Peta */}
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">
                2. Lokasi Operasional & Koordinat Peta
              </CardTitle>
              <CardDescription className="text-xs">
                Pilih unit perusahaan, estate kebun, dan blok lokasi pekerjaan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Perusahaan */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Perusahaan (Company) <span className="text-rose-500">*</span>
                  </Label>
                  <Select
                    value={selectedCompanyId}
                    onValueChange={(val) => {
                      setValue("companyId", val);
                      setValue("estateId", "");
                      setValue("blockId", null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Perusahaan" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.code} — {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.companyId && (
                    <p className="text-[11px] text-rose-500">{errors.companyId.message}</p>
                  )}
                </div>

                {/* Estate */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Estate Kebun <span className="text-rose-500">*</span>
                  </Label>
                  <Select
                    disabled={!selectedCompanyId}
                    value={selectedEstateId}
                    onValueChange={(val) => {
                      setValue("estateId", val);
                      setValue("blockId", null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          selectedCompanyId ? "Pilih Estate" : "Pilih Perusahaan dahulu"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableEstates.map((est) => (
                        <SelectItem key={est.id} value={est.id}>
                          {est.code} — {est.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.estateId && (
                    <p className="text-[11px] text-rose-500">{errors.estateId.message}</p>
                  )}
                </div>

                {/* Blok */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Blok Lapangan (Opsional)</Label>
                  <Select
                    disabled={!selectedEstateId}
                    value={watch("blockId") || ""}
                    onValueChange={(val) => setValue("blockId", val || null)}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={selectedEstateId ? "Pilih Blok" : "Pilih Estate dahulu"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBlocks.map((blk) => (
                        <SelectItem key={blk.id} value={blk.id}>
                          {blk.blockCode} — {blk.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Unggah Berkas Spasial (GeoJSON / Shapefile) — Opsional */}
              <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                      <Layers className="h-4 w-4 text-primary" />
                      <span>Berkas Geometri Spasial (Opsional)</span>
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
                        GeoJSON / Shapefile ZIP
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Unggah berkas batas poligon atau jalur saluran (format <code>.geojson</code>, <code>.json</code>, atau Shapefile <code>.zip</code>).
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".geojson,.json,.zip"
                        className="hidden"
                        onChange={handleGeoFileUpload}
                        disabled={geoFileLoading}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5 pointer-events-none"
                        disabled={geoFileLoading}
                      >
                        {geoFileLoading ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Membaca Berkas...
                          </>
                        ) : (
                          <>
                            <FileUp className="h-3.5 w-3.5 text-primary" />
                            Upload GeoJSON / Shapefile
                          </>
                        )}
                      </Button>
                    </label>
                  </div>
                </div>

                {geoFileError && (
                  <div className="rounded-md bg-destructive/15 p-2.5 text-xs text-destructive flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{geoFileError}</span>
                  </div>
                )}

                {geoFileInfo && (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/30 p-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      <div>
                        <span className="font-semibold">{geoFileInfo.name}</span>
                        <span className="text-[11px] opacity-80 ml-2">
                          ({geoFileInfo.geometryType} · {geoFileInfo.featureCount} fitur terdeteksi)
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearGeoFile}
                      className="h-7 text-xs text-destructive hover:bg-destructive/10 px-2 gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Hapus Geometri
                    </Button>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4 text-xs pt-1 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Tipe Geometri:</Label>
                    <Select
                      value={currentLocationType}
                      onValueChange={(val) => setValue("locationType", val as LocationType)}
                    >
                      <SelectTrigger className="h-7 text-xs w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={LocationType.POINT}>POINT (Titik)</SelectItem>
                        <SelectItem value={LocationType.LINE}>LINE (Jalur/Garis)</SelectItem>
                        <SelectItem value={LocationType.POLYGON}>POLYGON (Area)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {currentLocationType === LocationType.POINT && "Mode titik tunggal pada peta."}
                    {currentLocationType === LocationType.LINE && "Mode jalur/saluran air panjang."}
                    {currentLocationType === LocationType.POLYGON && "Mode bidang area/blok poligon."}
                  </span>
                </div>
              </div>

              {/* Koordinat & Peta Leaflet */}
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Latitude</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="Contoh: 0.533210"
                      value={currentLatitude ?? ""}
                      onChange={(e) =>
                        setValue(
                          "latitude",
                          e.target.value === "" ? null : Number(e.target.value)
                        )
                      }
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Longitude</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="Contoh: 101.450123"
                      value={currentLongitude ?? ""}
                      onChange={(e) =>
                        setValue(
                          "longitude",
                          e.target.value === "" ? null : Number(e.target.value)
                        )
                      }
                      className="font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <MapPicker
                    latitude={currentLatitude}
                    longitude={currentLongitude}
                    geoCoordinates={currentGeoCoordinates}
                    onChange={({ lat, lng }) => {
                      setValue("latitude", lat);
                      setValue("longitude", lng);
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bagian 3: Struktur & Varian (Template BOQ) */}
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">
                3. Spesifikasi Struktur Air & Template BOQ
              </CardTitle>
              <CardDescription className="text-xs">
                Tentukan tipe fisik struktur. Varian akan memuat template Bill of Quantities bawaan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Tipe Struktur Air <span className="text-rose-500">*</span>
                  </Label>
                  <Select
                    value={selectedStructureTypeId}
                    onValueChange={(val) => {
                      setValue("structureTypeId", val);
                      setValue("structureVariantId", null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Tipe Struktur" />
                    </SelectTrigger>
                    <SelectContent>
                      {structures.map((st) => (
                        <SelectItem key={st.id} value={st.id}>
                          {st.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.structureTypeId && (
                    <p className="text-[11px] text-rose-500">
                      {errors.structureTypeId.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Varian Dimensi / Tipe</Label>
                  <Select
                    disabled={!selectedStructureTypeId}
                    value={watch("structureVariantId") || ""}
                    onValueChange={handleVariantSelect}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          selectedStructureTypeId
                            ? "Pilih Varian Dimensi"
                            : "Pilih Tipe Struktur dahulu"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVariants.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.code} — {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* BOQ Template Editor */}
              <div className="pt-2">
                <BoqTemplateEditor
                  items={currentBoqItems}
                  onChange={(items) => setValue("boqItems", items)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Bagian 4: Anggaran & Jadwal Waktu */}
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">
                4. Anggaran & Target Pelaksanaan
              </CardTitle>
              <CardDescription className="text-xs">
                Perkiraan nilai investasi anggaran dan jadwal target operasional.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Tipe Anggaran</Label>
                  <Select
                    value={watch("budgetType")}
                    onValueChange={(val) => setValue("budgetType", val as BudgetType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={BudgetType.CAPEX_BUDGETED}>CAPEX Budgeted</SelectItem>
                      <SelectItem value={BudgetType.OPEX_BUDGETED}>OPEX Budgeted</SelectItem>
                      <SelectItem value={BudgetType.PTA}>PTA (Persetujuan Khusus)</SelectItem>
                      <SelectItem value={BudgetType.UNBUDGETED}>Unbudgeted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Total Anggaran (Rp) <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    step="any"
                    {...register("totalBudgetAmount")}
                    placeholder="0"
                    className="tabular-nums text-right font-medium"
                  />
                  {errors.totalBudgetAmount && (
                    <p className="text-[11px] text-rose-500">
                      {errors.totalBudgetAmount.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Target Kuantitas</Label>
                  <Input
                    type="number"
                    step="any"
                    {...register("targetQuantity")}
                    placeholder="Contoh: 1"
                    className="tabular-nums text-right"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Satuan (UoM)</Label>
                  <Select
                    value={watch("uom") || "unit"}
                    onValueChange={(val) => setValue("uom", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Satuan" />
                    </SelectTrigger>
                    <SelectContent>
                      {uoms.length > 0 ? (
                        uoms.map((u) => (
                          <SelectItem key={u.id} value={u.code}>
                            {u.code} — {u.name}
                          </SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="unit">unit — Unit / Buah</SelectItem>
                          <SelectItem value="m">m — Meter</SelectItem>
                          <SelectItem value="m3">m3 — Meter Kubik</SelectItem>
                          <SelectItem value="ha">ha — Hektar</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  {errors.uom && (
                    <p className="text-[11px] text-rose-500">{errors.uom.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Target Tanggal Mulai</Label>
                  <Input type="date" {...register("targetStartDate")} />
                  {errors.targetStartDate && (
                    <p className="text-[11px] text-rose-500">
                      {errors.targetStartDate.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Target Tanggal Selesai</Label>
                  <Input type="date" {...register("targetEndDate")} />
                  {errors.targetEndDate && (
                    <p className="text-[11px] text-rose-500">
                      {errors.targetEndDate.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Rencana Mulai Konstruksi (Opsional)
                  </Label>
                  <Input type="date" {...register("constructionPlanStartDate")} />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Rencana Selesai Konstruksi (Opsional)
                  </Label>
                  <Input type="date" {...register("constructionPlanEndDate")} />
                  {errors.constructionPlanEndDate && (
                    <p className="text-[11px] text-rose-500">
                      {errors.constructionPlanEndDate.message}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 5: Dokumen Perencanaan & Gambar Teknis */}
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">
                5. Dokumen Perencanaan & Gambar Teknis
              </CardTitle>
              <CardDescription className="text-xs">
                Unggah berkas denah lokasi (Site Plan) dan gambar kerja teknis (DED) ke Cloudflare R2.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 rounded-md border p-3.5 bg-muted/10">
                  <Label className="text-xs font-semibold">
                    Site Plan / Peta Denah Lokasi
                  </Label>
                  <p className="text-[11px] text-muted-foreground pb-1">
                    Berkas gambar atau PDF tata letak bangunan air.
                  </p>
                  <FileUploadButton
                    value={watch("sitePlanUrl")}
                    onChange={(url) => setValue("sitePlanUrl", url)}
                    folder="projects"
                    accept="image/*,application/pdf"
                    label="Unggah Site Plan"
                  />
                </div>

                <div className="space-y-1.5 rounded-md border p-3.5 bg-muted/10">
                  <Label className="text-xs font-semibold">
                    Gambar Kerja Teknis (DED / Drawing)
                  </Label>
                  <p className="text-[11px] text-muted-foreground pb-1">
                    Gambar konstruksi teknis, penulangan, atau kalkulasi struktur (PDF, Excel, Foto).
                  </p>
                  <FileUploadButton
                    value={watch("drawingUrl")}
                    onChange={(url) => setValue("drawingUrl", url)}
                    folder="projects"
                    accept="image/*,application/pdf,.xlsx,.xls"
                    label="Unggah Gambar Kerja"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Form Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              asChild
              disabled={isSubmitting}
            >
              <Link href="/projects">Batal</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting} className="min-w-[140px] font-semibold">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Simpan Proyek
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
