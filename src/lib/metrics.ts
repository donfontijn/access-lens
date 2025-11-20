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

const matchCount = (regex: RegExp, source?: string) => (source ? (source.match(regex)?.length ?? 0) : 0);

const analyzeTypography = (html?: string) => {
  const text = stripTags(html);
  const words = getWordCount(text);
  const sentences = getSentenceCount(text);
  const avgWordsPerSentence = sentences ? words / sentences : words;
  const headings = html ? (html.match(/<h[1-6][^>]*>/gi)?.length ?? 0) : 0;
  const paragraphs = html ? (html.match(/<p/gi)?.length ?? 0) : 0;
  const avgWordsPerParagraph = paragraphs ? words / paragraphs : words;

  const smallTextHits =
    matchCount(/text-(xs|sm)\b/gi, html) + matchCount(/font-size:\s*(1[0-3]px|14px)/gi, html);
  const lowContrastHits = matchCount(/text-(slate|gray|neutral)-(3\d0|4\d0)|#9\d\d|#aaa|rgba\((?:255,){2}255,0\.[1-6]\)/gi, html);
  const tightLineHeights = matchCount(/leading-(none|tight|snug)|line-height:\s*1\.[0-3]/gi, html);
  const lightWeightHits = matchCount(/font-(thin|extralight|light)/gi, html);
  const fontSizeTokens = html ? html.match(/text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|\[[^\]]+\])/gi) ?? [] : [];
  const uniqueFontSizes = new Set(fontSizeTokens).size;

  const widthMatches = html ? [...html.matchAll(/max-w-\[(\d+)(rem|px)\]/gi)] : [];
  const overlyWideBlocks = widthMatches.filter(([, value, unit]) => {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return false;
    const pixels = unit === "rem" ? numeric * 16 : numeric;
    return pixels > 750;
  }).length;
  const hasExplicitWidthControl =
    widthMatches.length > 0 ||
    (html ? /max-w-(sm|md|lg|xl|2xl|prose)/gi.test(html) : false);
  const wideBlockRisk = hasExplicitWidthControl ? overlyWideBlocks : paragraphs > 0 ? 1 : 0;

  return {
    words,
    sentences,
    avgWordsPerSentence,
    headings,
    paragraphs,
    avgWordsPerParagraph,
    smallTextHits,
    lowContrastHits,
    tightLineHeights,
    lightWeightHits,
    uniqueFontSizes,
    wideBlockRisk,
  };
};

type TypographySignals = ReturnType<typeof analyzeTypography>;

const calcReadability = (html?: string, typography?: TypographySignals) => {
  const signals = typography ?? analyzeTypography(html);
  const {
    words,
    sentences,
    avgWordsPerSentence,
    headings,
    smallTextHits,
    lowContrastHits,
    tightLineHeights,
    lightWeightHits,
    wideBlockRisk,
  } = signals;

  let score = 100;
  if (avgWordsPerSentence > 20) score -= (avgWordsPerSentence - 20) * 2;
  if (headings === 0) score -= 15;
  if (words < 50) score -= 10;
  if (smallTextHits) score -= smallTextHits * 4;
  if (lowContrastHits) score -= Math.min(20, lowContrastHits * 4);
  if (tightLineHeights) score -= tightLineHeights * 3;
  if (lightWeightHits) score -= lightWeightHits * 4;
  if (wideBlockRisk) score -= wideBlockRisk * 6;

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
  if (smallTextHits) {
    recommendations.push("Keep body copy at 16–18px to avoid penalising readers.");
  }
  if (lowContrastHits) {
    recommendations.push("Boost color contrast to meet WCAG AA (4.5:1 for body text).");
  }
  if (tightLineHeights) {
    recommendations.push("Use 1.5–1.7 line height for multi-line paragraphs.");
  }
  if (wideBlockRisk) {
    recommendations.push("Constrain long paragraphs to ~70 characters (≈44rem) for easier tracking.");
  }
  if (lightWeightHits) {
    recommendations.push("Use regular, medium, or semibold weights for core text.");
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
      smallTextHits,
      lowContrastHits,
      tightLineHeights,
      lightWeightHits,
      wideBlockRisk,
    },
  } as const;
};

const calcCognitiveLoad = (html?: string, typography?: TypographySignals) => {
  const signals = typography ?? analyzeTypography(html);
  const tags = html ? html.match(/<([a-z0-9-]+)/gi) ?? [] : [];
  const uniqueComponents = new Set(tags.map((tag) => tag.toLowerCase())).size;
  const interactiveElements = html ? (html.match(/<(button|a|input|select|textarea)/gi)?.length ?? 0) : 0;
  const { uniqueFontSizes, avgWordsPerParagraph } = signals;

  let score = 90 - uniqueComponents;
  if (interactiveElements > 8) score -= (interactiveElements - 8) * 2;
  if (uniqueFontSizes > 6) score -= (uniqueFontSizes - 6) * 2;
  if (avgWordsPerParagraph > 80) {
    score -= Math.min(20, (avgWordsPerParagraph - 80) * 0.5);
  }

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
  if (uniqueFontSizes > 6) {
    recommendations.push("Limit the number of simultaneous font sizes to keep typography calm.");
  }
  if (avgWordsPerParagraph > 80) {
    recommendations.push("Add spacing or bullet lists to avoid dense text walls.");
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
      uniqueFontSizes,
      avgWordsPerParagraph: Number(avgWordsPerParagraph.toFixed(1)),
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

const calcEmpathy = (html?: string, typography?: TypographySignals) => {
  const text = stripTags(html);
  const supportive = text ? (text.match(/thank|welcome|help|support|assist|calm|friendly/gi)?.length ?? 0) : 0;
  const jargon = text ? (text.match(/synergy|pipeline|KPI|leverage|compliance|policy/gi)?.length ?? 0) : 0;
  const signals = typography ?? analyzeTypography(html);

  let score = 70 + supportive * 5 - jargon * 4;
  if (signals.smallTextHits === 0 && signals.lowContrastHits === 0 && signals.tightLineHeights === 0) {
    score += 8;
  }
  if (signals.uniqueFontSizes <= 5 && signals.avgWordsPerParagraph <= 80) {
    score += 5;
  }

  const summary = supportive > jargon
    ? "Language leans helpful and human."
    : "Tone feels utilitarian — layer in more human cues.";

  const recommendations: string[] = [];
  if (supportive < 2) recommendations.push("Narrate intent with plain, supportive language.");
  if (jargon > 0) recommendations.push("Swap internal jargon for user-facing words.");
  if (signals.smallTextHits > 0 || signals.lowContrastHits > 0) {
    recommendations.push("Keep typography calm (16px+, strong contrast) so helpful content feels trustworthy.");
  }

  return {
    id: "empathy",
    label: "Empathy Alignment",
    score: clampScore(score),
    summary,
    recommendations,
    evidence: {
      supportivePhrases: supportive,
      jargonHits: jargon,
      calmTypographyBonus: signals.smallTextHits === 0 && signals.lowContrastHits === 0,
    },
  } as const;
};

export const evaluateAllMetrics = (html?: string) => {
  const typographySignals = analyzeTypography(html);
  const metrics = [
    calcReadability(html, typographySignals),
    calcCognitiveLoad(html, typographySignals),
    calcStressPoints(html),
    calcMemory(html),
    calcEmpathy(html, typographySignals),
  ];

  return metrics;
};

export type MetricResult = ReturnType<typeof evaluateAllMetrics>[number];
