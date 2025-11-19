const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const stripTags = (html?: string) =>
  html
    ?.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim() ?? "";

const getWordCount = (text: string) => (text ? text.split(/\s+/).length : 0);

const getSentenceCount = (text: string) => (text.match(/[.!?]/g)?.length ?? 1);

const calcReadability = (html?: string) => {
  const text = stripTags(html);
  const words = getWordCount(text);
  const sentences = getSentenceCount(text);
  const avgWordsPerSentence = words / sentences;
  const headings = html ? (html.match(/<h[1-6][^>]*>/gi)?.length ?? 0) : 0;

  let score = 100;
  if (avgWordsPerSentence > 20) score -= (avgWordsPerSentence - 20) * 2;
  if (headings === 0) score -= 15;
  if (words < 50) score -= 10;

  const summary = avgWordsPerSentence > 20
    ? "Dense copy detected — consider shorter sentences."
    : "Sentence cadence feels scannable.";

  const recommendations: string[] = [];
  if (avgWordsPerSentence > 20) {
    recommendations.push("Break long sentences into 2–3 clauses for easier scanning.");
  }
  if (headings < 2) {
    recommendations.push("Add hierarchy with headings or section labels.");
  }
  if (words < 80) {
    recommendations.push("Ensure enough descriptive text to set context for the screen.");
  }

  return {
    id: "readability",
    label: "Readability",
    score: clampScore(score),
    summary,
    recommendations,
    evidence: {
      words,
      sentences,
      avgWordsPerSentence: Number(avgWordsPerSentence.toFixed(1)),
      headings,
    },
  } as const;
};

const calcCognitiveLoad = (html?: string) => {
  const tags = html ? html.match(/<([a-z0-9-]+)/gi) ?? [] : [];
  const uniqueComponents = new Set(tags.map((tag) => tag.toLowerCase())).size;
  const interactiveElements = html ? (html.match(/<(button|a|input|select|textarea)/gi)?.length ?? 0) : 0;

  let score = 90 - uniqueComponents;
  if (interactiveElements > 8) score -= (interactiveElements - 8) * 2;

  const summary = interactiveElements > 8
    ? "Many simultaneous actions — consider progressive disclosure."
    : "Interaction surface looks manageable.";

  const recommendations: string[] = [];
  if (uniqueComponents > 30) {
    recommendations.push("Consolidate visual styles to reduce decision fatigue.");
  }
  if (interactiveElements > 8) {
    recommendations.push("Sequence actions into smaller groups or steps.");
  }

  return {
    id: "cognitive-load",
    label: "Cognitive Load",
    score: clampScore(score),
    summary,
    recommendations,
    evidence: {
      uniqueComponents,
      interactiveElements,
    },
  } as const;
};

const calcStressPoints = (html?: string) => {
  const alertWords = html ? (html.match(/error|warning|failed|urgent|alert/gi)?.length ?? 0) : 0;
  const redUsage = html ? (html.match(/#f{0,2}f{0,2}0{0,2}|red/gi)?.length ?? 0) : 0;
  const denseInputs = html ? (html.match(/<input/gi)?.length ?? 0) : 0;

  let score = 85;
  score -= alertWords * 5;
  score -= redUsage * 3;
  if (denseInputs > 6) score -= (denseInputs - 6) * 2;

  const summary = alertWords > 0
    ? "Warning language visible — ensure context and reassurance."
    : "No obvious stress triggers detected.";

  const recommendations: string[] = [];
  if (alertWords > 0) recommendations.push("Pair alerts with next-step guidance, not just warnings.");
  if (redUsage > 3) recommendations.push("Use calmer tones for emphasis unless truly critical.");
  if (denseInputs > 6) recommendations.push("Group related inputs and add breathing space.");

  return {
    id: "stress",
    label: "User Stress",
    score: clampScore(score),
    summary,
    recommendations,
    evidence: {
      alertWords,
      redUsage,
      denseInputs,
    },
  } as const;
};

const calcMemory = (html?: string) => {
  const fields = html ? (html.match(/<(input|select|textarea)/gi)?.length ?? 0) : 0;
  const steps = html ? (html.match(/step|progress|breadcrumb/gi)?.length ?? 0) : 0;

  let score = 95;
  if (fields > 6) score -= (fields - 6) * 4;
  if (steps === 0 && fields > 4) score -= 10;

  const summary = fields > 6
    ? "High working-memory burden from many simultaneous inputs."
    : "Form load feels within working-memory limits.";

  const recommendations: string[] = [];
  if (fields > 6) recommendations.push("Stage questions or use progressive disclosure.");
  if (steps === 0) recommendations.push("Show progress or chunk tasks so users understand sequence.");

  return {
    id: "memory",
    label: "Memory Load",
    score: clampScore(score),
    summary,
    recommendations,
    evidence: {
      fields,
      stepIndicators: steps,
    },
  } as const;
};

const calcEmpathy = (html?: string) => {
  const text = stripTags(html);
  const supportive = text ? (text.match(/thank|welcome|help|support|assist|calm|friendly/gi)?.length ?? 0) : 0;
  const jargon = text ? (text.match(/synergy|pipeline|KPI|leverage|compliance|policy/gi)?.length ?? 0) : 0;

  const score = 70 + supportive * 5 - jargon * 4;
  const summary = supportive > jargon
    ? "Language leans helpful and human."
    : "Tone feels utilitarian — layer in more human cues.";

  const recommendations: string[] = [];
  if (supportive < 2) recommendations.push("Narrate intent with plain, supportive language.");
  if (jargon > 0) recommendations.push("Swap internal jargon for user-facing words.");

  return {
    id: "empathy",
    label: "Empathy Alignment",
    score: clampScore(score),
    summary,
    recommendations,
    evidence: {
      supportivePhrases: supportive,
      jargonHits: jargon,
    },
  } as const;
};

export const evaluateAllMetrics = (html?: string) => {
  const metrics = [
    calcReadability(html),
    calcCognitiveLoad(html),
    calcStressPoints(html),
    calcMemory(html),
    calcEmpathy(html),
  ];

  return metrics;
};

export type MetricResult = ReturnType<typeof evaluateAllMetrics>[number];
