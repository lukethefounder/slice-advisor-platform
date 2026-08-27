import type { Metadata } from "next";

import ForecastLabWorkspace from "@/components/intelligence/forecast-lab-workspace";

export const metadata: Metadata = {
  title: "Forecast Lab",
  description:
    "Generate current point-in-time Slice forecasts from bounded equal-third intelligence research.",
};

export default function ForecastLabPage() {
  return <ForecastLabWorkspace />;
}