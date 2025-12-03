"use client";

import { useEffect, useState, useRef } from "react";
import createGlobe from "cobe";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, MapPin, Globe as GlobeIcon } from "lucide-react";

interface CountryData {
  country: string;
  countryCode: string;
  validators: number;
  totalStaked: string;
  percentage: number;
  latitude: number;
  longitude: number;
}

type VisualizationMode = "validators" | "stake";

interface Marker {
  location: [number, number];
  size: number;
}

interface GlobeProps {
  className?: string;
  markers?: Marker[];
  autoRotate?: boolean;
}

function Globe({ className, markers = [], autoRotate = true }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    let phi = rotation;
    let width = 0;

    if (!canvasRef.current) return;

    const onResize = () => {
      if (canvasRef.current) {
        width = canvasRef.current.offsetWidth;
      }
    };
    window.addEventListener("resize", onResize);
    onResize();

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: 600 * 2,
      height: 600 * 2,
      phi: 0,
      theta: 0.3,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.3, 0.3, 0.3],
      markerColor: [0.91, 0.26, 0.26],
      glowColor: [1, 1, 1],
      markers: markers,
      onRender: (state) => {
        if (!pointerInteracting.current) {
          if (autoRotate) {
            phi += 0.001;
          }
        }
        state.phi = phi + pointerInteractionMovement.current;
        setRotation(phi);
      },
    });

    setTimeout(() => {
      if (canvasRef.current) {
        canvasRef.current.style.opacity = "1";
      }
    });

    return () => {
      globe.destroy();
      window.removeEventListener("resize", onResize);
    };
  }, [markers, autoRotate]);

  return (
    <div
      className={className}
      style={{
        width: "100%",
        maxWidth: 600,
        aspectRatio: 1,
        margin: "auto",
        position: "relative",
        cursor: "grab",
      }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          pointerInteracting.current =
            e.clientX - pointerInteractionMovement.current;
          if (canvasRef.current) {
            canvasRef.current.style.cursor = "grabbing";
          }
        }}
        onPointerUp={() => {
          pointerInteracting.current = null;
          if (canvasRef.current) {
            canvasRef.current.style.cursor = "grab";
          }
        }}
        onPointerOut={() => {
          pointerInteracting.current = null;
          if (canvasRef.current) {
            canvasRef.current.style.cursor = "grab";
          }
        }}
        onMouseMove={(e) => {
          if (pointerInteracting.current !== null) {
            const delta = e.clientX - pointerInteracting.current;
            pointerInteractionMovement.current = delta * 0.005; // Slow down manual rotation
          }
        }}
        onTouchMove={(e) => {
          if (pointerInteracting.current !== null && e.touches[0]) {
            const delta = e.touches[0].clientX - pointerInteracting.current;
            pointerInteractionMovement.current = delta * 0.005; // Slow down manual rotation
          }
        }}
        style={{
          width: "100%",
          height: "100%",
          contain: "layout paint size",
          opacity: 0,
          transition: "opacity 1s ease",
          cursor: "grab",
        }}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}

export function ValidatorWorldMap() {
  const [geoData, setGeoData] = useState<CountryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [visualMode, setVisualMode] = useState<VisualizationMode>("validators");

  useEffect(() => {
    setIsClient(true);
    fetchGeoData();
  }, []);

  const fetchGeoData = async () => {
    try {
      const response = await fetch("/api/validator-geolocation");
      if (!response.ok) throw new Error("Failed to fetch geolocation data");

      const data = await response.json();
      setGeoData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load map data");
    } finally {
      setLoading(false);
    }
  };

  const formatStaked = (staked: string) => {
    // Convert to AVAX by dividing by 10^9
    const rawAmount = parseFloat(staked);
    const avaxAmount = rawAmount / 1e9;

    if (avaxAmount >= 1e6) return `${(avaxAmount / 1e6).toFixed(1)}M`;
    if (avaxAmount >= 1e3) return `${(avaxAmount / 1e3).toFixed(1)}K`;
    if (avaxAmount >= 100) return `${avaxAmount.toFixed(0)}`;
    if (avaxAmount >= 1) return `${avaxAmount.toFixed(1)}`;
    return avaxAmount.toFixed(3);
  };

  const getMarkerSize = (country: CountryData, maxValue: number) => {
    const minSize = 0.02;
    const maxSize = 0.15;
    let value: number;

    switch (visualMode) {
      case "stake":
        value = parseFloat(country.totalStaked) / 1e9;
        break;
      default:
        value = country.validators;
    }

    const ratio = value / maxValue;
    return minSize + (maxSize - minSize) * ratio;
  };

  const getMaxValue = () => {
    switch (visualMode) {
      case "stake":
        return Math.max(...geoData.map((d) => parseFloat(d.totalStaked) / 1e9));
      default:
        return Math.max(...geoData.map((d) => d.validators));
    }
  };

  const getMarkers = () => {
    const maxValue = getMaxValue();
    return geoData.map((country) => ({
      location: [country.latitude, country.longitude] as [number, number],
      size: getMarkerSize(country, maxValue),
    }));
  };

  const themeColor = "#E57373";

  if (!isClient) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2 font-medium">
            <GlobeIcon className="h-5 w-5" style={{ color: themeColor }} />
            Global Validator Distribution
          </CardTitle>
          <CardDescription>
            Geographic distribution of Avalanche Primary Network validators
            worldwide
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[500px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2 font-medium">
            <GlobeIcon className="h-5 w-5" style={{ color: themeColor }} />
            Global Validator Distribution
          </CardTitle>
          <CardDescription>
            Geographic distribution of Avalanche Primary Network validators
            worldwide
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[500px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm text-muted-foreground">
              Loading validator locations...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2 font-medium">
            <GlobeIcon className="h-5 w-5" style={{ color: themeColor }} />
            Global Validator Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[500px] flex items-center justify-center">
          <div className="text-center">
            <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              onClick={fetchGeoData}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const markers = getMarkers();

  // Sort countries by the selected visualization metric
  const sortedCountries = [...geoData].sort((a, b) => {
    switch (visualMode) {
      case "stake":
        return parseFloat(b.totalStaked) - parseFloat(a.totalStaked);
      default:
        return b.validators - a.validators;
    }
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle className="text-xl flex items-center gap-2 font-medium">
              <GlobeIcon className="h-5 w-5" style={{ color: themeColor }} />
              Global Validator Distribution
            </CardTitle>
            <CardDescription>
              Geographic distribution of Avalanche Primary Network validators
              worldwide
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setVisualMode("validators")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                visualMode === "validators"
                  ? "text-white dark:text-white"
                  : "text-muted-foreground hover:bg-muted"
              }`}
              style={
                visualMode === "validators"
                  ? { backgroundColor: themeColor, opacity: 0.9 }
                  : {}
              }
            >
              Validators
            </button>
            <button
              onClick={() => setVisualMode("stake")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                visualMode === "stake"
                  ? "text-white dark:text-white"
                  : "text-muted-foreground hover:bg-muted"
              }`}
              style={
                visualMode === "stake"
                  ? { backgroundColor: themeColor, opacity: 0.9 }
                  : {}
              }
            >
              Stake
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Globe on the left */}
          <div className="w-full flex items-center justify-center">
            <Globe markers={markers} autoRotate={true} />
          </div>

          {/* Country list on the right */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-4">
              Top Countries by{" "}
              {visualMode === "validators" ? "Validator Count" : "Total Stake"}
            </h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              {sortedCountries.map((country, index) => (
                <div
                  key={`${country.countryCode}-${index}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400 w-6">
                      {index + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      {country.countryCode && (
                        <img
                          src={`https://flagcdn.com/16x12/${country.countryCode.toLowerCase()}.png`}
                          alt={`${country.country} flag`}
                          width="24"
                          height="18"
                          className="rounded-sm"
                        />
                      )}
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {country.country}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {visualMode === "validators"
                        ? `${country.validators.toLocaleString()}`
                        : `${formatStaked(country.totalStaked)} AVAX`}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      {country.percentage.toFixed(1)}% share
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
