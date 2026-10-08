"use client";

import type { GeoJsonObject } from "geojson";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import React, { useEffect, useRef } from "react";

interface MapPickerProps {
  latitude?: number | null;
  longitude?: number | null;
  geoCoordinates?: GeoJsonObject | null;
  onChange: (coords: { lat: number; lng: number }) => void;
  className?: string;
}

const customPinIcon = L.divIcon({
  className: "custom-map-pin",
  html: `
    <div style="
      background-color: #0284c7;
      width: 26px;
      height: 26px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid white;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
    </div>
  `,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

export default function MapPicker({
  latitude,
  longitude,
  geoCoordinates,
  onChange,
  className = "h-[320px] w-full rounded-md border border-border overflow-hidden",
}: MapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Default ke area perkebunan (Sumatera / Riau) jika belum ada koordinat
  const defaultLat = 0.5333;
  const defaultLng = 101.45;

  const currentLat = latitude !== null && latitude !== undefined ? latitude : defaultLat;
  const currentLng = longitude !== null && longitude !== undefined ? longitude : defaultLng;
  const hasCoords =
    latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined;

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [currentLat, currentLng],
        zoom: hasCoords ? 13 : 8,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      if (hasCoords) {
        markerRef.current = L.marker([currentLat, currentLng], {
          icon: customPinIcon,
          draggable: true,
        }).addTo(map);

        markerRef.current.on("dragend", (e) => {
          const latlng = e.target.getLatLng();
          onChangeRef.current({
            lat: Number(latlng.lat.toFixed(6)),
            lng: Number(latlng.lng.toFixed(6)),
          });
        });
      }

      map.on("click", (e) => {
        const { lat, lng } = e.latlng;
        const fixedLat = Number(lat.toFixed(6));
        const fixedLng = Number(lng.toFixed(6));

        if (markerRef.current) {
          markerRef.current.setLatLng([fixedLat, fixedLng]);
        } else {
          markerRef.current = L.marker([fixedLat, fixedLng], {
            icon: customPinIcon,
            draggable: true,
          }).addTo(map);

          markerRef.current.on("dragend", (event) => {
            const dragLatLng = event.target.getLatLng();
            onChangeRef.current({
              lat: Number(dragLatLng.lat.toFixed(6)),
              lng: Number(dragLatLng.lng.toFixed(6)),
            });
          });
        }

        onChangeRef.current({ lat: fixedLat, lng: fixedLng });
      });

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sinkronisasi posisi marker ketika latitude / longitude berubah dari luar
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (hasCoords) {
      if (markerRef.current) {
        markerRef.current.setLatLng([currentLat, currentLng]);
      } else {
        markerRef.current = L.marker([currentLat, currentLng], {
          icon: customPinIcon,
          draggable: true,
        }).addTo(mapInstanceRef.current);

        markerRef.current.on("dragend", (event) => {
          const dragLatLng = event.target.getLatLng();
          onChangeRef.current({
            lat: Number(dragLatLng.lat.toFixed(6)),
            lng: Number(dragLatLng.lng.toFixed(6)),
          });
        });
      }
    }
  }, [latitude, longitude, currentLat, currentLng, hasCoords]);

  // Sinkronisasi layer GeoJSON ketika geoCoordinates berubah
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (geoJsonLayerRef.current) {
      mapInstanceRef.current.removeLayer(geoJsonLayerRef.current);
      geoJsonLayerRef.current = null;
    }

    if (geoCoordinates) {
      try {
        const layer = L.geoJSON(geoCoordinates, {
          style: {
            color: "#0284c7",
            weight: 3,
            opacity: 0.9,
            fillColor: "#0284c7",
            fillOpacity: 0.25,
          },
        }).addTo(mapInstanceRef.current);

        geoJsonLayerRef.current = layer;

        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          mapInstanceRef.current.fitBounds(bounds, {
            padding: [24, 24],
            maxZoom: 16,
          });
        }
      } catch (err) {
        console.error("Gagal merender layer GeoJSON:", err);
      }
    }
  }, [geoCoordinates]);

  return (
    <div className="relative space-y-1">
      <div ref={mapContainerRef} className={className} />
      <p className="text-xs text-muted-foreground">
        {geoCoordinates
          ? "Geometri file ditampilkan di peta. Anda tetap dapat menyeret pin untuk menetapkan titik acuan koordinat utama."
          : "Klik pada peta atau seret pin untuk menentukan koordinat lokasi proyek."}
      </p>
    </div>
  );
}
