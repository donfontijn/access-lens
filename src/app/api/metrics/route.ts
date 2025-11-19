import { NextRequest, NextResponse } from "next/server";
import { evaluateAllMetrics } from "@/lib/metrics";

type MetricsPayload = {
  html?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MetricsPayload;
    const { html } = body;

    if (!html || html.length < 20) {
      return NextResponse.json(
        { error: "Insufficient HTML supplied for heuristic scoring." },
        { status: 400 },
      );
    }

    const metrics = evaluateAllMetrics(html);
    return NextResponse.json({ metrics, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Metrics evaluation failed", error);
    return NextResponse.json(
      { error: "Failed to evaluate metrics." },
      { status: 500 },
    );
  }
}
