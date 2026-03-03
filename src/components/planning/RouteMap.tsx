/// <reference types="google.maps" />
import { useEffect, useState, useMemo } from "react";
import { APIProvider, Map, Marker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { supabase } from "@/integrations/supabase/client";
import type { OptimizedStop } from "@/hooks/useMapbox";
import { Loader2 } from "lucide-react";

const useGoogleMapsKey = () => {
  const [key, setKey] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.functions.invoke("google-maps-proxy", { body: { action: "get-key" } })
      .then(({ data }) => { if (!cancelled && data?.key) setKey(data.key); });
    return () => { cancelled = true; };
  }, []);
  return key;
};

// Colors for route segments
const MARKER_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f43f5e", "#6366f1",
];

interface RouteMapProps {
  stops: OptimizedStop[];
  companyOrigin?: string | null;
}

function DirectionsRenderer({ stops, companyOrigin }: RouteMapProps) {
  const map = useMap();
  const routesLib = useMapsLibrary("routes");
  const geocodingLib = useMapsLibrary("geocoding");

  useEffect(() => {
    if (!map || !routesLib || !stops.length) return;

    const directionsService = new routesLib.DirectionsService();
    const directionsRenderer = new routesLib.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: "hsl(var(--primary))",
        strokeWeight: 4,
        strokeOpacity: 0.8,
      },
    });

    const waypoints = stops.slice(1, -1).map((s) => ({
      location: new google.maps.LatLng(s.lat, s.lng),
      stopover: true,
    }));

    // Origin: company address (geocode it) or first stop
    const buildRoute = (origin: google.maps.LatLng | string) => {
      const destination = companyOrigin
        ? origin // round trip back to origin
        : new google.maps.LatLng(stops[stops.length - 1].lat, stops[stops.length - 1].lng);

      const allWaypoints = companyOrigin
        ? stops.map((s) => ({ location: new google.maps.LatLng(s.lat, s.lng), stopover: true }))
        : waypoints;

      directionsService.route(
        {
          origin,
          destination,
          waypoints: allWaypoints,
          travelMode: google.maps.TravelMode.DRIVING,
          optimizeWaypoints: false, // Already optimized
        },
        (result, status) => {
          if (status === "OK" && result) {
            directionsRenderer.setDirections(result);
          }
        }
      );
    };

    if (companyOrigin && geocodingLib) {
      const geocoder = new geocodingLib.Geocoder();
      geocoder.geocode({ address: companyOrigin, region: "nl" }, (results, status) => {
        if (status === "OK" && results?.[0]) {
          buildRoute(results[0].geometry.location);
        } else {
          buildRoute(new google.maps.LatLng(stops[0].lat, stops[0].lng));
        }
      });
    } else {
      buildRoute(new google.maps.LatLng(stops[0].lat, stops[0].lng));
    }

    return () => {
      directionsRenderer.setMap(null);
    };
  }, [map, routesLib, geocodingLib, stops, companyOrigin]);

  return null;
}

export default function RouteMap({ stops, companyOrigin }: RouteMapProps) {
  const apiKey = useGoogleMapsKey();

  const center = useMemo(() => {
    if (!stops.length) return { lat: 52.1, lng: 5.1 };
    const avgLat = stops.reduce((s, st) => s + st.lat, 0) / stops.length;
    const avgLng = stops.reduce((s, st) => s + st.lng, 0) / stops.length;
    return { lat: avgLat, lng: avgLng };
  }, [stops]);

  if (!apiKey) {
    return (
      <div className="flex items-center justify-center h-[250px] bg-muted/30 rounded-md">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-md overflow-hidden border border-border h-[250px]">
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={center}
          defaultZoom={10}
          gestureHandling="cooperative"
          disableDefaultUI
          zoomControl
          style={{ width: "100%", height: "100%" }}
          mapId="route-map"
        >
          {stops.map((stop, idx) => (
            <Marker
              key={stop.appointment_id}
              position={{ lat: stop.lat, lng: stop.lng }}
              label={{
                text: String(idx + 1),
                color: "#fff",
                fontWeight: "bold",
                fontSize: "11px",
              }}
              title={stop.label}
            />
          ))}
          <DirectionsRenderer stops={stops} companyOrigin={companyOrigin} />
        </Map>
      </APIProvider>
    </div>
  );
}
