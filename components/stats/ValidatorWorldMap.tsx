"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, MapPin, Globe } from "lucide-react";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const CircleMarker = dynamic(
  () => import("react-leaflet").then((mod) => mod.CircleMarker),
  { ssr: false }
);
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), {
  ssr: false,
});
const Tooltip = dynamic(
  () => import("react-leaflet").then((mod) => mod.Tooltip),
  {
    ssr: false,
  }
);

interface CountryData {
  country: string;
  countryCode: string;
  validators: number;
  totalStaked: string;
  percentage: number;
  latitude: number;
  longitude: number;
}

type VisualizationMode = "validators" | "stake" | "heatmap";

export function ValidatorWorldMap() {
  const [geoData, setGeoData] = useState<CountryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [visualMode, setVisualMode] = useState<VisualizationMode>("validators");
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

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
    const minSize = 6;
    const maxSize = 30;
    let value: number;

    switch (visualMode) {
      case "stake":
        // Convert to AVAX by dividing by 10^9
        value = parseFloat(country.totalStaked) / 1e9;
        break;
      case "heatmap":
        value = country.percentage;
        break;
      default:
        value = country.validators;
    }

    const ratio = value / maxValue;
    return minSize + (maxSize - minSize) * ratio;
  };

  const getMarkerColor = (
    country: CountryData,
    maxValue: number,
    isHovered: boolean = false
  ) => {
    let value: number;

    switch (visualMode) {
      case "stake":
        // Convert to AVAX by dividing by 10^9
        value = parseFloat(country.totalStaked) / 1e9;
        break;
      case "heatmap":
        value = country.percentage;
        break;
      default:
        value = country.validators;
    }

    const ratio = value / maxValue;
    let baseColor: string;

    if (visualMode === "heatmap") {
      if (ratio > 0.8) baseColor = "#dc2626";
      else if (ratio > 0.6) baseColor = "#ea580c";
      else if (ratio > 0.4) baseColor = "#d97706";
      else if (ratio > 0.2) baseColor = "#65a30d";
      else baseColor = "#0284c7";
    } else {
      if (ratio > 0.7) baseColor = "#ef4444";
      else if (ratio > 0.4) baseColor = "#f97316";
      else if (ratio > 0.2) baseColor = "#eab308";
      else baseColor = "#22c55e";
    }

    return isHovered ? baseColor : baseColor;
  };

  const getMaxValue = () => {
    switch (visualMode) {
      case "stake":
        // Convert to AVAX by dividing by 10^9
        return Math.max(...geoData.map((d) => parseFloat(d.totalStaked) / 1e9));
      case "heatmap":
        return Math.max(...geoData.map((d) => d.percentage));
      default:
        return Math.max(...geoData.map((d) => d.validators));
    }
  };

  if (!isClient) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" style={{ color: "#40c9ff" }} />
            Global Validator Distribution
          </CardTitle>
          <CardDescription className="pt-2">
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
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" style={{ color: "#40c9ff" }} />
            Global Validator Distribution
          </CardTitle>
          <CardDescription className="pt-2">
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
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" style={{ color: "#40c9ff" }} />
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

  const maxValue = getMaxValue();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" style={{ color: "#40c9ff" }} />
              Global Validator Distribution
            </CardTitle>
            <CardDescription className="pt-2">
              Geographic distribution of Avalanche Primary Network validators
              worldwide
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setVisualMode("validators")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                visualMode === "validators"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              Validators
            </button>
            <button
              onClick={() => setVisualMode("stake")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                visualMode === "stake"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              Stake
            </button>
            <button
              onClick={() => setVisualMode("heatmap")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                visualMode === "heatmap"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              Heatmap
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 px-0 pb-0">
        <div className="h-[500px] w-full">
          <MapContainer
            center={[20, 0]}
            zoom={2}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={false}
            zoomControl={false}
            dragging={true}
            touchZoom={false}
            doubleClickZoom={false}
            boxZoom={false}
            keyboard={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            {geoData.map((country, index) => {
              const isHovered = hoveredCountry === country.countryCode;
              return (
                <CircleMarker
                  key={`${country.countryCode}-${index}`}
                  center={[country.latitude, country.longitude]}
                  radius={getMarkerSize(country, maxValue)}
                  fillColor={getMarkerColor(country, maxValue, isHovered)}
                  color={isHovered ? "#000000" : "#ffffff"}
                  weight={isHovered ? 3 : 2}
                  opacity={isHovered ? 1 : 0.9}
                  fillOpacity={isHovered ? 0.9 : 0.7}
                  eventHandlers={{
                    mouseover: () => setHoveredCountry(country.countryCode),
                    mouseout: () => setHoveredCountry(null),
                  }}
                >
                  <Tooltip
                    permanent={false}
                    direction="top"
                    offset={[0, -10]}
                    className="bg-black/80 text-white text-sm rounded px-2 py-1"
                  >
                    <div className="text-center">
                      <div className="font-semibold">{country.country}</div>
                      <div className="text-xs">
                        {visualMode === "validators" &&
                          `${country.validators} validators`}
                        {visualMode === "stake" &&
                          `${formatStaked(country.totalStaked)} AVAX`}
                        {visualMode === "heatmap" &&
                          `${country.percentage.toFixed(1)}% share`}
                      </div>
                    </div>
                  </Tooltip>
                  <Popup>
                    <div className="min-w-[200px] p-2">
                      <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                        <span
                          className="text-2xl"
                          role="img"
                          aria-label={country.country}
                        >
                          {country.countryCode && (
                            <img
                              src={`https://flagcdn.com/16x12/${country.countryCode.toLowerCase()}.png`}
                              alt={`${country.country} flag`}
                              width="20"
                              height="15"
                              className="inline"
                            />
                          )}
                        </span>
                        {country.country}
                      </h3>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Validators:
                          </span>
                          <span className="font-medium">
                            {country.validators.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Total Staked:
                          </span>
                          <span className="font-medium">
                            {formatStaked(country.totalStaked)} AVAX
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Network Share:
                          </span>
                          <span className="font-medium">
                            {country.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  );
}
