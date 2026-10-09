import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email wajib diisi")
    .email("Format email tidak valid")
    .transform((val) => val.trim().toLowerCase()),
  password: z.string().min(1, "Kata sandi wajib diisi"),
  rememberMe: z.boolean().optional().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;
