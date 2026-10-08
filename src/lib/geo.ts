import { LocationType } from "@prisma/client";
import type { Feature, FeatureCollection, GeoJsonObject, Geometry } from "geojson";

export interface ParsedGeoData {
  geoJson: FeatureCollection;
  locationType: LocationType;
  center: { lat: number; lng: number };
  featureCount: number;
  geometryType: string;
  fileName: string;
}

/**
 * Ekstrak semua koordinat [lng, lat] dari GeoJSON secara rekursif
 */
function extractAllCoordinates(geomOrCoords: unknown): [number, number][] {
  if (!geomOrCoords) return [];

  // Jika array koordinat [lng, lat]
  if (
    Array.isArray(geomOrCoords) &&
    geomOrCoords.length >= 2 &&
    typeof geomOrCoords[0] === "number" &&
    typeof geomOrCoords[1] === "number"
  ) {
    return [[geomOrCoords[0], geomOrCoords[1]]];
  }

  // Jika array berulang (LineString, Polygon, MultiPolygon)
  if (Array.isArray(geomOrCoords)) {
    return geomOrCoords.flatMap(extractAllCoordinates);
  }

  if (typeof geomOrCoords === "object" && geomOrCoords !== null) {
    const record = geomOrCoords as Record<string, unknown>;

    // Jika objek Geometry
    if ("coordinates" in record) {
      return extractAllCoordinates(record.coordinates);
    }

    // Jika Feature
    if ("geometry" in record) {
      return extractAllCoordinates(record.geometry);
    }

    // Jika FeatureCollection
    if ("features" in record && Array.isArray(record.features)) {
      return record.features.flatMap((f: unknown) => extractAllCoordinates(f));
    }
  }

  return [];
}

/**
 * Hitung titik tengah (centroid / center of bounding box) dari daftar koordinat [lng, lat]
 */
function calculateCenter(coords: [number, number][]): { lat: number; lng: number } {
  if (coords.length === 0) {
    return { lat: 0.5333, lng: 101.45 }; // Default Riau/Sumatera
  }

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const centerLat = Number(((minLat + maxLat) / 2).toFixed(6));
  const centerLng = Number(((minLng + maxLng) / 2).toFixed(6));

  return { lat: centerLat, lng: centerLng };
}

/**
 * Deteksi tipe lokasi dominan (POLYGON, LINE, atau POINT)
 */
function detectLocationType(geoJson: FeatureCollection): { locationType: LocationType; typeName: string } {
  const types = new Set<string>();

  for (const feature of geoJson.features) {
    if (feature.geometry) {
      types.add(feature.geometry.type);
    }
  }

  if (types.has("Polygon") || types.has("MultiPolygon")) {
    return { locationType: LocationType.POLYGON, typeName: "Polygon" };
  }
  if (types.has("LineString") || types.has("MultiLineString")) {
    return { locationType: LocationType.LINE, typeName: "Polyline / Jalur" };
  }
  if (types.has("Point") || types.has("MultiPoint")) {
    return { locationType: LocationType.POINT, typeName: "Titik (Point)" };
  }

  return { locationType: LocationType.POLYGON, typeName: "Geometri" };
}

/**
 * Normalisasi data menjadi format GeoJSON FeatureCollection standar
 */
function normalizeToFeatureCollection(data: unknown): FeatureCollection | null {
  if (!data || typeof data !== "object") return null;

  const record = data as Record<string, unknown>;

  if (record.type === "FeatureCollection" && Array.isArray(record.features)) {
    return data as FeatureCollection;
  }

  if (record.type === "Feature" && "geometry" in record) {
    return {
      type: "FeatureCollection",
      features: [data as Feature],
    };
  }

  if (typeof record.type === "string" && "coordinates" in record) {
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: data as Geometry,
        },
      ],
    };
  }

  if (Array.isArray(data)) {
    const features: Feature[] = [];
    for (const item of data) {
      const itemFc = normalizeToFeatureCollection(item);
      if (itemFc) {
        features.push(...itemFc.features);
      }
    }
    return {
      type: "FeatureCollection",
      features,
    };
  }

  return null;
}

/**
 * Parse file GeoJSON (.geojson, .json) atau Shapefile (.zip) di client
 */
export async function parseGeoFile(file: File): Promise<ParsedGeoData> {
  const fileName = file.name.toLowerCase();
  let rawData: unknown = null;

  if (fileName.endsWith(".geojson") || fileName.endsWith(".json")) {
    const text = await file.text();
    try {
      rawData = JSON.parse(text) as GeoJsonObject;
    } catch {
      throw new Error("File GeoJSON tidak valid atau korup (bukan format JSON yang benar)");
    }
  } else if (fileName.endsWith(".zip")) {
    const buffer = await file.arrayBuffer();
    try {
      // Dynamic import shpjs agar tidak membebani initial bundle
      const shp = (await import("shpjs")).default;
      rawData = await shp(buffer);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "pastikan ZIP berisi file .shp, .shx, dan .dbf";
      throw new Error(`Gagal membaca Shapefile ZIP: ${msg}`);
    }
  } else {
    throw new Error(
      "Format file tidak didukung. Harap upload file .geojson, .json, atau Shapefile .zip"
    );
  }

  const normalized = normalizeToFeatureCollection(rawData);
  if (!normalized || !Array.isArray(normalized.features) || normalized.features.length === 0) {
    throw new Error("File tidak memuat geometri fitur peta yang dapat dibaca.");
  }

  const coords = extractAllCoordinates(normalized);
  if (coords.length === 0) {
    throw new Error("Tidak ditemukan koordinat titik dalam file geometri.");
  }

  const center = calculateCenter(coords);
  const { locationType, typeName } = detectLocationType(normalized);

  return {
    geoJson: normalized,
    locationType,
    center,
    featureCount: normalized.features.length,
    geometryType: typeName,
    fileName: file.name,
  };
}
