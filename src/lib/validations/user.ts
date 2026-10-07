import { Role } from "@prisma/client";
import { z } from "zod";

export const createUserSchema = z.object({
  email: z
    .string()
    .min(1, "Email wajib diisi")
    .email("Format email tidak valid")
    .transform((v) => v.trim().toLowerCase()),
  name: z.string().min(1, "Nama wajib diisi").transform((v) => v.trim()),
  password: z.string().min(6, "Password minimal 6 karakter"),
  role: z.nativeEnum(Role, {
    errorMap: () => ({ message: "Peran (role) pengguna tidak valid" }),
  }).default(Role.WM_HO_SPECIALIST),
  isActive: z.boolean().default(true),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  id: z.string().min(1, "ID pengguna wajib disertakan"),
  name: z.string().min(1, "Nama wajib diisi").transform((v) => v.trim()).optional(),
  email: z
    .string()
    .email("Format email tidak valid")
    .transform((v) => v.trim().toLowerCase())
    .optional(),
  role: z.nativeEnum(Role, {
    errorMap: () => ({ message: "Peran (role) pengguna tidak valid" }),
  }).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({
  id: z.string().min(1, "ID pengguna wajib disertakan"),
  newPassword: z.string().min(6, "Password baru minimal 6 karakter"),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
