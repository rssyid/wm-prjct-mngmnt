import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
} from "@/lib/validations/user";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// Eksplisit field yang boleh dikembalikan ke client (tanpa password & rememberToken)
const USER_SAFE_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      projectsCreated: true,
      workPackagesCreated: true,
      progressLogsCreated: true,
    },
  },
} as const;

/**
 * GET /api/users
 * Mengambil seluruh daftar pengguna.
 * Hak akses: SUPER_ADMIN saja.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole("SUPER_ADMIN");

    const search = request.nextUrl.searchParams.get("search")?.trim() || "";
    const role = request.nextUrl.searchParams.get("role")?.trim();

    const users = await prisma.user.findMany({
      where: {
        ...(role ? { role: role as Role } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: USER_SAFE_SELECT,
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess(users);
  } catch (error) {
    return handleApiError(error, "Gagal mengambil data pengguna");
  }
}

/**
 * POST /api/users
 * Membuat akun pengguna baru.
 * Password di-hash via bcrypt (salt 10).
 * Hak akses: SUPER_ADMIN saja.
 */
export async function POST(request: NextRequest) {
  try {
    await requireRole("SUPER_ADMIN");

    const body = await request.json();
    const validated = createUserSchema.parse(body);

    // Cek apakah email sudah terdaftar
    const existing = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existing) {
      return apiError(`Email '${validated.email}' sudah terdaftar dalam sistem`, 409);
    }

    // Hash kata sandi
    const hashedPassword = await bcrypt.hash(validated.password, 10);

    const created = await prisma.user.create({
      data: {
        email: validated.email,
        name: validated.name,
        password: hashedPassword,
        role: validated.role,
        isActive: validated.isActive,
      },
      select: USER_SAFE_SELECT,
    });

    return apiSuccess(created, undefined, 201);
  } catch (error) {
    return handleApiError(error, "Gagal membuat akun pengguna baru");
  }
}

/**
 * PUT /api/users
 * Memperbarui data pengguna, peran, toggle status aktif/nonaktif,
 * atau melakukan reset kata sandi langsung oleh admin.
 * Hak akses: SUPER_ADMIN saja.
 */
export async function PUT(request: NextRequest) {
  try {
    await requireRole("SUPER_ADMIN");

    const body = await request.json();

    // Skenario A: Reset Password
    if (body.newPassword !== undefined) {
      const validated = resetPasswordSchema.parse(body);
      const hashedPassword = await bcrypt.hash(validated.newPassword, 10);

      const updated = await prisma.user.update({
        where: { id: validated.id },
        data: {
          password: hashedPassword,
        },
        select: USER_SAFE_SELECT,
      });

      return apiSuccess(updated);
    }

    // Skenario B: Update profil biasa / role / toggle isActive
    const validated = updateUserSchema.parse(body);

    // Jika ganti email, pastikan tidak konflik dengan user lain
    if (validated.email) {
      const existing = await prisma.user.findFirst({
        where: {
          email: validated.email,
          NOT: { id: validated.id },
        },
      });

      if (existing) {
        return apiError(`Email '${validated.email}' sudah digunakan oleh akun lain`, 409);
      }
    }

    const updated = await prisma.user.update({
      where: { id: validated.id },
      data: {
        name: validated.name,
        email: validated.email,
        role: validated.role,
        isActive: validated.isActive,
      },
      select: USER_SAFE_SELECT,
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "Gagal memperbarui data pengguna");
  }
}

/**
 * DELETE /api/users?id=...
 * Menghapus akun pengguna (hanya jika tidak memiliki riwayat data kritis).
 * Hak akses: SUPER_ADMIN saja.
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireRole("SUPER_ADMIN");

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return apiError("Parameter 'id' wajib disertakan", 400);
    }

    if (id === session.user.id) {
      return apiError("Anda tidak dapat menghapus akun Anda sendiri saat sedang login", 400);
    }

    // Cek relasi
    const projectCount = await prisma.project.count({ where: { createdById: id } });
    if (projectCount > 0) {
      return apiError(
        `Pengguna tidak dapat dihapus karena tercatat sebagai pembuat ${projectCount} proyek. Nonaktifkan status akun sebagai gantinya.`,
        409
      );
    }

    await prisma.user.delete({
      where: { id },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error, "Gagal menghapus pengguna");
  }
}
