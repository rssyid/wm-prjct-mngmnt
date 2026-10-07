import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class AppError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  meta?: Record<string, unknown>;
  error?: string;
  details?: unknown;
}

export function apiSuccess<T>(data: T, meta?: Record<string, unknown>, status = 200) {
  const body: ApiResponse<T> = { success: true, data };
  if (meta) {
    body.meta = meta;
  }
  return NextResponse.json(body, { status });
}

export function apiError(message: string, status = 400, details?: unknown) {
  const body: ApiResponse = { success: false, error: message };
  if (details !== undefined) {
    body.details = details;
  }
  return NextResponse.json(body, { status });
}

export function handleApiError(
  error: unknown,
  fallbackMessage = "Terjadi kesalahan pada server"
) {
  console.error("API Error caught:", error);

  if (error instanceof AppError) {
    return apiError(error.message, error.statusCode, error.details);
  }

  if (error instanceof ZodError) {
    return apiError("Validasi data gagal", 400, error.flatten().fieldErrors);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002: Unique constraint violation
    if (error.code === "P2002") {
      const target = (error.meta?.target as string[])?.join(", ") || "kolom unik";
      return apiError(`Data duplikat: nilai pada ${target} sudah digunakan`, 409);
    }
    // P2025: Record not found
    if (error.code === "P2025") {
      return apiError("Data yang diminta tidak ditemukan", 404);
    }
    // P2003: Foreign key constraint violation
    if (error.code === "P2003") {
      return apiError(
        "Data tidak dapat diproses karena berelasi dengan data lain",
        409
      );
    }
  }

  // Generic 500 error: tidak membocorkan detail/stack trace
  return apiError(fallbackMessage, 500);
}
