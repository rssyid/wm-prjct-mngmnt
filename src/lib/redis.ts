import { Redis } from "@upstash/redis";

let redisClient: Redis | null = null;

/**
 * Singleton client untuk Upstash Redis REST API.
 * Mengembalikan null jika kredensial belum diset (misal dalam mode testing/CI).
 */
export function getRedisClient(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  redisClient = new Redis({
    url,
    token,
  });

  return redisClient;
}

/**
 * Invalidasi cache dashboard Upstash Redis.
 * Menghapus semua key dengan pola "dash:*" (termasuk "dash:global" dan "dash:company:*").
 * Wajib dipanggil di setiap mutasi domain (proyek, paket kerja, progres, afce, bast).
 * Bersifat aman (non-blocking) sehingga error jaringan pada Redis tidak membatalkan transaksi DB.
 */
export async function invalidateDashboardCache(): Promise<void> {
  try {
    const redis = getRedisClient();
    if (!redis) {
      return;
    }

    // Ambil semua cache key dashboard
    const keys = await redis.keys("dash:*");
    if (keys && keys.length > 0) {
      await redis.del(...keys);
    } else {
      // Fallback pastikan key global selalu dibersihkan
      await redis.del("dash:global");
    }
  } catch (error) {
    console.error("[Upstash Redis] Gagal menginvalidasi cache dashboard:", error);
  }
}
