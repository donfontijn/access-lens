import { NextRequest, NextResponse } from "next/server";
import { evaluateAllMetrics } from "@/lib/metrics";
import { analyzeWithGreenpt } from "@/lib/greenpt";
import { generateLLMAnalysis } from "@/lib/llm-analysis";

type AnalyzePayload = {
  html?: string;
  screenshotDataUrl?: string;
  url?: string;
};

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AnalyzePayload;
    const { html, screenshotDataUrl, url } = body;

    if (!html && !screenshotDataUrl && !url) {
      return NextResponse.json(
        { error: "Provide HTML, screenshot, or URL to analyze." },
        { status: 400 },
      );
    }

    const heuristicMetrics = html ? evaluateAllMetrics(html) : [];

    const greenptData = await analyzeWithGreenpt({
      image: screenshotDataUrl,
      html,
      url,
    });

    const llmAnalysis = await generateLLMAnalysis({
      metrics: heuristicMetrics,
      greenpt: greenptData,
      html,
      screenshotDataUrl,
    });

    return NextResponse.json({
      metrics: heuristicMetrics,
      greenpt: greenptData,
      analysis: llmAnalysis,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Analysis failed", error);
    return NextResponse.json(
      { error: "Failed to complete analysis." },
      { status: 500 },
    );
  }
}
