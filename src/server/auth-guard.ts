import { AppError } from "@/lib/api-error";
import { authOptions } from "@/lib/auth";
import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";

/**
 * Memeriksa apakah sesi pengguna aktif.
 * Melempar AppError(401) jika belum login atau sesi telah kedaluwarsa.
 */
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    throw new AppError("Sesi telah berakhir atau belum terotentikasi", 401);
  }
  return session;
}

/**
 * Memeriksa apakah role pengguna yang sedang login diizinkan.
 * Melempar AppError(403) jika role tidak memenuhi syarat.
 */
export async function requireRole(...allowedRoles: Role[]) {
  const session = await requireSession();
  if (!allowedRoles.includes(session.user.role)) {
    throw new AppError("Anda tidak memiliki hak akses untuk aksi ini", 403);
  }
  return session;
}
