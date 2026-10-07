"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  CreateUserInput,
  createUserSchema,
  ResetPasswordInput,
  UpdateUserInput,
  updateUserSchema,
} from "@/lib/validations/user";
import { zodResolver } from "@hookform/resolvers/zod";
import { Role } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import {
  Edit,
  KeyRound,
  Search,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    projectsCreated: number;
    workPackagesCreated: number;
    progressLogsCreated: number;
  };
}

interface UserManagementClientProps {
  currentUserId?: string;
}

export function UserManagementClient({ currentUserId }: UserManagementClientProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<string>("all");

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = React.useState(search);
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<UserRow | null>(null);
  const [resettingUser, setResettingUser] = React.useState<UserRow | null>(null);
  const [deletingUser, setDeletingUser] = React.useState<UserRow | null>(null);
  const [deleteErrorMsg, setDeleteErrorMsg] = React.useState<string | null>(null);

  // Fetch Users
  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ["users", debouncedSearch, roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (roleFilter !== "all") params.append("role", roleFilter);

      const res = await fetch(`/api/users?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal memuat pengguna");
      return json.data;
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: CreateUserInput) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal membuat pengguna");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setIsCreateOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateUserInput) => {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal memperbarui pengguna");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditingUser(null);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordInput) => {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal mereset kata sandi");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setResettingUser(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      setDeleteErrorMsg(null);
      const res = await fetch(`/api/users?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal menghapus pengguna");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeletingUser(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Gagal menghapus pengguna";
      setDeleteErrorMsg(msg);
    },
  });

  // Format Helper
  const formatRoleBadge = (role: Role) => {
    switch (role) {
      case Role.SUPER_ADMIN:
        return (
          <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800 text-[11px] font-mono">
            SUPER_ADMIN
          </Badge>
        );
      case Role.WM_HO_SPECIALIST:
        return (
          <Badge className="bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800 text-[11px] font-mono">
            WM_HO_SPECIALIST
          </Badge>
        );
      case Role.MANAGEMENT_VIEWER:
        return (
          <Badge className="bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800 text-[11px] font-mono">
            MANAGEMENT_VIEWER
          </Badge>
        );
      default:
        return <Badge variant="secondary">{role}</Badge>;
    }
  };

  const columns: ColumnDef<UserRow>[] = [
    {
      accessorKey: "name",
      header: "Nama Pengguna",
      cell: ({ row }) => (
        <div>
          <div className="font-semibold text-foreground text-sm flex items-center space-x-2">
            <span>{row.original.name}</span>
            {row.original.id === currentUserId && (
              <Badge variant="outline" className="text-[10px] h-4 px-1 border-primary text-primary">
                Anda
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground font-mono">{row.original.email}</div>
        </div>
      ),
    },
    {
      accessorKey: "role",
      header: "Peran Hak Akses",
      cell: ({ row }) => formatRoleBadge(row.original.role),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          <Switch
            checked={row.original.isActive}
            disabled={row.original.id === currentUserId}
            onCheckedChange={(checked: boolean) => {
              updateMutation.mutate({
                id: row.original.id,
                isActive: checked,
              });
            }}
          />
          <span className="text-xs font-medium">
            {row.original.isActive ? "Aktif" : "Nonaktif"}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "_count.projectsCreated",
      header: "Riwayat Proyek",
      cell: ({ row }) => (
        <span className="text-xs font-mono text-muted-foreground">
          {row.original._count?.projectsCreated || 0} Proyek
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Tanggal Registrasi",
      cell: ({ row }) => {
        const d = new Date(row.original.createdAt);
        return (
          <span className="text-xs text-muted-foreground tabular-nums">
            {d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => (
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Edit Pengguna & Peran"
            aria-label={`Edit pengguna ${row.original.name}`}
            onClick={() => setEditingUser(row.original)}
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
            title="Reset Password Langsung"
            aria-label={`Reset kata sandi pengguna ${row.original.name}`}
            onClick={() => setResettingUser(row.original)}
          >
            <KeyRound className="h-3.5 w-3.5" />
          </Button>

          {row.original.id !== currentUserId && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:bg-destructive/10"
              title="Hapus Akun Pengguna"
              aria-label={`Hapus pengguna ${row.original.name}`}
              onClick={() => {
                setDeleteErrorMsg(null);
                setDeletingUser(row.original);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center space-x-2">
            <Users className="h-6 w-6 text-primary" />
            <span>Manajemen Pengguna</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Pengelolaan akun staf, pemberian peran hak akses (Role), toggle keaktifan, dan reset kata sandi langsung.
          </p>
        </div>

        <div>
          <Button
            className="font-semibold shadow-xs"
            onClick={() => setIsCreateOpen(true)}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Tambah Pengguna Baru
          </Button>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="border-border shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-2">
              <CardTitle className="text-base font-semibold">Daftar Akun Pengguna</CardTitle>
              <Badge variant="outline" className="font-mono text-xs">
                {users.length} Akun
              </Badge>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2">
              {/* Role filter */}
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-8 text-xs w-[180px]">
                  <SelectValue placeholder="Filter Peran" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">-- Semua Peran --</SelectItem>
                  <SelectItem value="SUPER_ADMIN">SUPER_ADMIN</SelectItem>
                  <SelectItem value="WM_HO_SPECIALIST">WM_HO_SPECIALIST</SelectItem>
                  <SelectItem value="MANAGEMENT_VIEWER">MANAGEMENT_VIEWER</SelectItem>
                </SelectContent>
              </Select>

              {/* Search */}
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Cari nama atau email..."
                  className="pl-8 h-8 text-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <DataTable columns={columns} data={users} isLoading={isLoading} />
        </CardContent>
      </Card>

      {/* Dialog: Buat Pengguna Baru */}
      <CreateUserDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSubmit={async (data) => {
          await createMutation.mutateAsync(data);
        }}
      />

      {/* Dialog: Edit Pengguna */}
      <EditUserDialog
        user={editingUser}
        open={Boolean(editingUser)}
        onOpenChange={(open) => !open && setEditingUser(null)}
        onSubmit={async (data) => {
          await updateMutation.mutateAsync(data);
        }}
      />

      {/* Dialog: Reset Password */}
      <ResetPasswordDialog
        user={resettingUser}
        open={Boolean(resettingUser)}
        onOpenChange={(open) => !open && setResettingUser(null)}
        onSubmit={async (newPassword) => {
          if (resettingUser) {
            await resetPasswordMutation.mutateAsync({
              id: resettingUser.id,
              newPassword,
            });
          }
        }}
      />

      {/* Alert Dialog Delete User */}
      <AlertDialog
        open={Boolean(deletingUser)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingUser(null);
            setDeleteErrorMsg(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Konfirmasi Hapus Akun Pengguna
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <div>
                Apakah Anda yakin ingin menghapus akun{" "}
                <span className="font-semibold text-foreground">
                  {deletingUser?.name} ({deletingUser?.email})
                </span>
                ? Tindakan ini bersifat permanen.
              </div>

              {deleteErrorMsg && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-md font-medium">
                  {deleteErrorMsg}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Batal
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deletingUser) {
                  deleteMutation.mutate(deletingUser.id);
                }
              }}
            >
              {deleteMutation.isPending ? "Menghapus..." : "Ya, Hapus Akun"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Form Dialog: Tambah Pengguna Baru
// -----------------------------------------------------------------------------
function CreateUserDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateUserInput) => Promise<void>;
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: Role.WM_HO_SPECIALIST,
      isActive: true,
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        name: "",
        email: "",
        password: "",
        role: Role.WM_HO_SPECIALIST,
        isActive: true,
      });
      setErrorMsg(null);
    }
  }, [open, reset]);

  const onFormSubmit = async (values: CreateUserInput) => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSubmit(values);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal membuat pengguna baru";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <form onSubmit={handleSubmit(onFormSubmit)}>
          <DialogHeader>
            <DialogTitle>Tambah Pengguna Baru</DialogTitle>
            <DialogDescription>
              Buat akun staf baru dan tentukan peran akses ke sistem WM PRJCT MNGMNT.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {errorMsg && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-md">
                {errorMsg}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="usr-name" className="text-xs">
                Nama Lengkap <span className="text-destructive">*</span>
              </Label>
              <Input
                id="usr-name"
                placeholder="cth: Budi Santoso"
                className="text-xs"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="usr-email" className="text-xs">
                Alamat Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="usr-email"
                type="email"
                placeholder="budi.santoso@perusahaan.com"
                className="text-xs font-mono"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="usr-pass" className="text-xs">
                Kata Sandi Awal <span className="text-destructive">*</span>
              </Label>
              <Input
                id="usr-pass"
                type="password"
                placeholder="Minimal 6 karakter"
                className="text-xs font-mono"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Peran Hak Akses (Role) <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="text-xs font-mono">
                      <SelectValue placeholder="Pilih Peran" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WM_HO_SPECIALIST">
                        WM_HO_SPECIALIST (Operasional & Transisi)
                      </SelectItem>
                      <SelectItem value="MANAGEMENT_VIEWER">
                        MANAGEMENT_VIEWER (Hanya Lihat / Read-only)
                      </SelectItem>
                      <SelectItem value="SUPER_ADMIN">
                        SUPER_ADMIN (Akses Penuh & Verifikasi BAST)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex items-center justify-between border rounded-md p-3">
              <div>
                <Label htmlFor="usr-active" className="text-xs font-medium">
                  Status Akun Aktif
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Akun aktif dapat masuk (login) ke dalam sistem.
                </p>
              </div>
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <Switch
                    id="usr-active"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Menyimpan..." : "Buat Pengguna"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Form Dialog: Edit Pengguna & Peran
// -----------------------------------------------------------------------------
function EditUserDialog({
  user,
  open,
  onOpenChange,
  onSubmit,
}: {
  user: UserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: UpdateUserInput) => Promise<void>;
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      id: "",
      name: "",
      email: "",
      role: Role.WM_HO_SPECIALIST,
      isActive: true,
    },
  });

  React.useEffect(() => {
    if (user) {
      reset({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      });
      setErrorMsg(null);
    }
  }, [user, reset]);

  const onFormSubmit = async (values: UpdateUserInput) => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSubmit(values);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memperbarui pengguna";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <form onSubmit={handleSubmit(onFormSubmit)}>
          <DialogHeader>
            <DialogTitle>Ubah Pengguna & Hak Akses</DialogTitle>
            <DialogDescription>
              Perbarui profil nama, email, atau tingkat peran pengguna.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {errorMsg && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-md">
                {errorMsg}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="edit-name" className="text-xs">
                Nama Lengkap
              </Label>
              <Input id="edit-name" className="text-xs" {...register("name")} />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-email" className="text-xs">
                Alamat Email
              </Label>
              <Input
                id="edit-email"
                type="email"
                className="text-xs font-mono"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Peran Hak Akses (Role)</Label>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="text-xs font-mono">
                      <SelectValue placeholder="Pilih Peran" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WM_HO_SPECIALIST">
                        WM_HO_SPECIALIST (Operasional & Transisi)
                      </SelectItem>
                      <SelectItem value="MANAGEMENT_VIEWER">
                        MANAGEMENT_VIEWER (Hanya Lihat / Read-only)
                      </SelectItem>
                      <SelectItem value="SUPER_ADMIN">
                        SUPER_ADMIN (Akses Penuh & Verifikasi BAST)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex items-center justify-between border rounded-md p-3">
              <div>
                <Label htmlFor="edit-active" className="text-xs font-medium">
                  Status Akun Aktif
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Akun non-aktif akan dicegah login ke aplikasi.
                </p>
              </div>
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <Switch
                    id="edit-active"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Form Dialog: Reset Password Langsung
// -----------------------------------------------------------------------------
function ResetPasswordDialog({
  user,
  open,
  onOpenChange,
  onSubmit,
}: {
  user: UserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (newPassword: string) => Promise<void>;
}) {
  const [newPassword, setNewPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setNewPassword("");
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [open]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setErrorMsg("Kata sandi baru minimal 6 karakter");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSubmit(newPassword);
      setSuccessMsg("Kata sandi berhasil direset!");
      setTimeout(() => {
        onOpenChange(false);
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mereset kata sandi";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <form onSubmit={handleReset}>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <KeyRound className="h-5 w-5 text-amber-600" />
              <span>Reset Kata Sandi</span>
            </DialogTitle>
            <DialogDescription>
              Set kata sandi baru secara langsung untuk pengguna{" "}
              <span className="font-semibold text-foreground">{user?.name}</span> ({user?.email}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {errorMsg && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-md">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs rounded-md font-medium">
                {successMsg}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="new-pass" className="text-xs">
                Kata Sandi Baru <span className="text-destructive">*</span>
              </Label>
              <Input
                id="new-pass"
                type="password"
                placeholder="Minimal 6 karakter"
                className="text-xs font-mono"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Kata sandi akan langsung di-hash menggunakan bcrypt di sisi server.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || newPassword.length < 6}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isSubmitting ? "Mereset..." : "Simpan Password Baru"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
