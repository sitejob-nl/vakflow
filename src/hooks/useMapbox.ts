import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GeocodeSuggestion {
  place_name: string;
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
  lat: number | null;
  lng: number | null;
}

export interface DirectionsResult {
  duration_minutes: number | null;
  distance_km: number | null;
}

export const useGeocode = () => {
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((query: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("mapbox-proxy", {
          body: { action: "geocode", query },
        });
        if (error) throw error;
        setSuggestions(data ?? []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const clear = useCallback(() => setSuggestions([]), []);

  return { suggestions, loading, search, clear };
};

export const useDirections = () => {
  const [result, setResult] = useState<DirectionsResult | null>(null);
  const [loading, setLoading] = useState(false);

  const calculate = useCallback(
    async (from: [number, number], to: [number, number]) => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("mapbox-proxy", {
          body: { action: "directions", from, to },
        });
        if (error) throw error;
        setResult(data);
        return data as DirectionsResult;
      } catch {
        setResult(null);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { result, loading, calculate };
};

export interface OptimizedStop {
  appointment_id: string;
  label: string;
  lat: number;
  lng: number;
  travel_time_minutes: number;
  distance_km: number;
  original_index: number;
}

export interface OptimizeRouteResult {
  stops: OptimizedStop[];
  skipped: string[];
  summary: {
    total_travel_minutes: number;
    total_distance_km: number;
    return_leg: { travel_time_minutes: number; distance_km: number } | null;
    waypoint_count: number;
    skipped_count: number;
  };
  company_origin: string | null;
}

export const useOptimizeRoute = () => {
  const [result, setResult] = useState<OptimizeRouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optimize = useCallback(
    async (params: { date: string; assigned_to?: string; round_trip?: boolean }) => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fnError } = await supabase.functions.invoke("optimize-route", {
          body: params,
        });
        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);
        setResult(data as OptimizeRouteResult);
        return data as OptimizeRouteResult;
      } catch (err: any) {
        setError(err.message ?? "Onbekende fout");
        setResult(null);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, loading, error, optimize, reset };
};
