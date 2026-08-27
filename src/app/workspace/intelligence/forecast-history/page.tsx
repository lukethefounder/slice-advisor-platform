import type { Metadata } from "next";

import ForecastHistoryWorkspace from "@/components/intelligence/forecast-history-workspace";

export const metadata: Metadata = {
  title: "Forecast History and Accuracy",
  description:
    "Review retained Slice forecast runs, observed outcomes, calibration, and directional accuracy.",
};

export default function ForecastHistoryPage() {
  return <ForecastHistoryWorkspace />;
}
