type MetricResult = {
  id: string;
  label: string;
  score: number;
  summary: string;
  recommendations: string[];
  evidence?: Record<string, unknown>;
};

type GreenptData = {
  overallScore?: number;
  contrast?: { score?: number; issues?: unknown[] };
  textExtraction?: { text?: string; headings?: string[]; links?: string[] };
  layout?: { complexity?: number; focusableElements?: number; visualHierarchy?: number };
  errors?: string[];
};

type LLMAnalysisRequest = {
  metrics: MetricResult[];
  greenpt?: GreenptData;
  html?: string;
  screenshotDataUrl?: string;
};

type LLMAnalysisResponse = {
  overallScore: number;
  topIssues: Array<{ metric: string; issue: string; severity: "high" | "medium" | "low" }>;
  recommendations: Array<{
    title: string;
    description: string;
    impact: "high" | "medium" | "low";
    effort: "quick" | "medium" | "long-term";
  }>;
  summary: string;
};

export async function generateLLMAnalysis(
  input: LLMAnalysisRequest,
): Promise<LLMAnalysisResponse> {
  const apiKey = process.env.GREENPT_API_KEY;
  const baseUrl = process.env.GREENPT_BASE_URL || "https://api.greenpt.ai";
  if (!apiKey) {
    return generateFallbackAnalysis(input);
  }

  const metricsSummary = input.metrics
    .map((m) => `- ${m.label}: ${m.score}/100 - ${m.summary}`)
    .join("\n");

  const greenptSummary = input.greenpt
    ? `\n\nVisual Analysis:\n- Overall Accessibility Score: ${input.greenpt.overallScore ?? "N/A"}/100\n- Contrast score: ${input.greenpt.contrast?.score ?? "N/A"}/100\n- Layout complexity: ${input.greenpt.layout?.complexity ?? "N/A"}/100 (lower is better)\n- Visual hierarchy: ${input.greenpt.layout?.visualHierarchy ?? "N/A"}/100\n- Focusable elements: ${input.greenpt.layout?.focusableElements ?? "N/A"}\n- Contrast issues found: ${input.greenpt.contrast?.issues?.length ?? 0}`
    : "";

  const prompt = `You are an accessibility design consultant. Analyze the following metrics and provide actionable recommendations.

Metrics:
${metricsSummary}${greenptSummary}

Provide a JSON response with:
1. overallScore: 0-100 average of all metric scores
2. topIssues: array of {metric: string, issue: string, severity: "high"|"medium"|"low"} - top 3 issues
3. recommendations: array of {title: string, description: string, impact: "high"|"medium"|"low", effort: "quick"|"medium"|"long-term"} - prioritized actionable recommendations
4. summary: 2-3 sentence executive summary

Return ONLY valid JSON, no markdown formatting.`;

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "green-l",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`GreenPT API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error("No content in GreenPT response");

    const parsed = JSON.parse(content) as LLMAnalysisResponse;
    return parsed;
  } catch (error) {
    console.warn("GreenPT LLM analysis failed, using fallback:", error);
    return generateFallbackAnalysis(input);
  }
}

function generateFallbackAnalysis(input: LLMAnalysisRequest): LLMAnalysisResponse {
  const avgScore = Math.round(
    input.metrics.reduce((sum, m) => sum + m.score, 0) / input.metrics.length,
  );

  const allRecommendations = input.metrics.flatMap((m) =>
    m.recommendations.map((rec) => ({
      title: `${m.label} Improvement`,
      description: rec,
      impact: m.score < 50 ? ("high" as const) : m.score < 70 ? ("medium" as const) : ("low" as const),
      effort: "medium" as const,
    })),
  );

  const topIssues = input.metrics
    .filter((m) => m.score < 70)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((m) => ({
      metric: m.label,
      issue: m.summary,
      severity: m.score < 50 ? ("high" as const) : ("medium" as const),
    }));

  return {
    overallScore: avgScore,
    topIssues,
    recommendations: allRecommendations.slice(0, 8),
    summary: `Overall accessibility score: ${avgScore}/100. ${topIssues.length} key areas need attention.`,
  };
}

