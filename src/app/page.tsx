"use client";

import Image from "next/image";
import { useCallback, useMemo, useRef, useState, useId, useEffect } from "react";

type IngestResponse = {
  screenshotDataUrl?: string;
  fetchedHtml?: string;
  metadata?: {
    source?: "upload" | "url" | "placeholder";
    url?: string;
    status?: number;
    contentType?: string | null;
    bytes?: number;
  };
  warnings?: string[];
  note?: string;
  error?: string;
};

type MetricResult = {
  id: string;
  label: string;
  score: number;
  summary: string;
  recommendations: string[];
  evidence: Record<string, number | string>;
};

const ACCEPTED_FILE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILE_BYTES = 8 * 1024 * 1024;

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [file, setFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [response, setResponse] = useState<IngestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MetricResult[] | null>(null);
  const [metricsTimestamp, setMetricsTimestamp] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<{
    overallScore: number;
    topIssues: Array<{ metric: string; issue: string; severity: string }>;
    recommendations: Array<{ title: string; description: string; impact: string; effort: string }>;
    summary: string;
  } | null>(null);
  const [greenptData, setGreenptData] = useState<{
    overallScore?: number;
    contrast?: { score?: number; issues?: Array<{ element?: string; ratio?: number; level?: string }> };
    layout?: { complexity?: number; focusableElements?: number; visualHierarchy?: number };
    textExtraction?: { text?: string; headings?: string[]; links?: string[] };
    errors?: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputId = useId();
  const fileHintId = useId();
  const urlInputId = useId();
  const urlHintId = useId();
  const errorRegionId = useId();
  const warningsRegionId = useId();
  const runAnalysisHintId = useId();
  const screenshotHeadingId = useId();
  const themeToggleId = useId();

  // Theme icons mapping
  const metricIcons: Record<string, string> = {
    readability: "📖",
    "cognitive-load": "🧠",
    stress: "⚠️",
    memory: "💭",
    empathy: "❤️",
  };

  const fileHint = useMemo(() => {
    if (!file) return "PNG, JPG, or WEBP up to 8MB";
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return `${file.name} • ${sizeMb}MB`;
  }, [file]);

  const triggerFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDropKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLLabelElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        triggerFileDialog();
      }
    },
    [triggerFileDialog],
  );

  const handleFile = useCallback((incoming: File | null) => {
    if (!incoming) return;
    if (!ACCEPTED_FILE_TYPES.includes(incoming.type)) {
      setError("Unsupported format. Please use PNG, JPG, or WEBP.");
      return;
    }
    if (incoming.size > MAX_FILE_BYTES) {
      setError("File is over 8MB. Please compress the screenshot.");
      return;
    }
    setError(null);
    setFile(incoming);
    setPreview(URL.createObjectURL(incoming));
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      const dropped = event.dataTransfer?.files?.[0];
      if (dropped) {
        handleFile(dropped);
      }
    },
    [handleFile],
  );

  const handleAnalyze = useCallback(async () => {
    if (!file && !urlInput.trim()) {
      setError("Add a screenshot or enter a URL to analyze.");
      return;
    }

    setIsAnalyzing(true);
    setStatusMessage("Preparing your input…");
    setError(null);
    setResponse(null);
    setMetrics(null);
    setAnalysis(null);
    setGreenptData(null);
    setMetricsTimestamp(null);

    try {
      const formData = new FormData();
      if (file) {
        formData.append("screenshot", file);
      }
      if (urlInput.trim()) {
        formData.append("url", urlInput.trim());
      }

      const ingestRes = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      if (!ingestRes.ok) {
        const payload = await ingestRes.json().catch(() => ({}));
        throw new Error(payload.error ?? "Unable to ingest input.");
      }

      const ingestPayload = (await ingestRes.json()) as IngestResponse;
      if (ingestPayload.error) {
        throw new Error(ingestPayload.error);
      }

      if (ingestPayload.screenshotDataUrl) {
        setPreview(ingestPayload.screenshotDataUrl);
      }
      setResponse(ingestPayload);
      if (ingestPayload.warnings && ingestPayload.warnings.length > 0) {
        console.warn("Ingestion warnings:", ingestPayload.warnings);
      }

      setStatusMessage("Running analysis…");

      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          html: ingestPayload.fetchedHtml,
          screenshotDataUrl: ingestPayload.screenshotDataUrl,
          url: ingestPayload.metadata?.url ?? urlInput.trim(),
        }),
      });

      if (!analyzeRes.ok) {
        const payload = await analyzeRes.json().catch(() => ({}));
        throw new Error(payload.error ?? "Analysis engine unavailable.");
      }

      const analysisPayload = (await analyzeRes.json()) as {
        metrics: MetricResult[];
        greenpt?: {
          overallScore?: number;
          contrast?: { score?: number; issues?: Array<{ element?: string; ratio?: number; level?: string }> };
          layout?: { complexity?: number; focusableElements?: number; visualHierarchy?: number };
          textExtraction?: { text?: string; headings?: string[]; links?: string[] };
          errors?: string[];
        };
        analysis: {
          overallScore: number;
          topIssues: Array<{ metric: string; issue: string; severity: string }>;
          recommendations: Array<{ title: string; description: string; impact: string; effort: string }>;
          summary: string;
        };
        generatedAt: string;
      };

      setMetrics(analysisPayload.metrics);
      setAnalysis(analysisPayload.analysis);
      setGreenptData(analysisPayload.greenpt || null);
      setMetricsTimestamp(analysisPayload.generatedAt);
      setStatusMessage("Analysis complete.");
    } catch (analyzeError) {
      setError(
        analyzeError instanceof Error
          ? analyzeError.message
          : "Unexpected analysis error.",
      );
      setStatusMessage(null);
    } finally {
      setIsAnalyzing(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  }, [file, urlInput]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  // Apply theme class to document
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const themeClasses = theme === "light" 
    ? "bg-white text-slate-900"
    : "bg-slate-950 text-slate-50";
  
  const cardClasses = theme === "light"
    ? "border-slate-200 bg-slate-50 text-slate-900"
    : "border-white/10 bg-slate-900 text-slate-50";
  
  const inputClasses = theme === "light"
    ? "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
    : "border-slate-700 bg-slate-950 text-white placeholder:text-slate-400";
  
  const textMutedClasses = theme === "light"
    ? "text-slate-600"
    : "text-slate-400";
  
  const textSecondaryClasses = theme === "light"
    ? "text-slate-500"
    : "text-slate-300";

  return (
    <div className={`min-h-screen transition-colors ${themeClasses}`}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <main id="main-content" className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-4 py-12 sm:px-8 lg:px-12" role="main">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8 shadow-2xl shadow-slate-950/40">
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-teal-500/50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-teal-200">
              <span role="img" aria-label="logo">👁️‍🗨️</span>
              Access Lens
            </span>
            <button
              id={themeToggleId}
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xl text-teal-200 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
          </div>
          <h1 className="mt-6 text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
            <span className="mr-3 text-5xl" role="img" aria-label="Upload">📤</span>
            <span className="bg-gradient-to-r from-slate-50 via-teal-200 to-slate-50 bg-clip-text text-transparent">
              Drop a screen or paste a URL—get clarity in one pass.
            </span>
          </h1>
          <p className={`mt-4 max-w-3xl text-lg ${textSecondaryClasses}`}>
            We surface the human signals—readability, cognitive load, visual stress—without the compliance noise.
            Upload production pixels or point to any live flow and Access Lens stitches heuristics, visual analysis,
            and AI critique together for you.
          </p>
          <div className="mt-6 grid gap-4 text-sm text-slate-200 sm:grid-cols-3">
            {[
              { icon: "⚡", label: "Ingestion", desc: "Drag, drop, or paste any screen." },
              { icon: "🧠", label: "Human Metrics", desc: "Five-signal heuristic snapshot." },
              { icon: "🤖", label: "Visual + AI", desc: "Visual analysis + LLM insights." },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                <p className="flex items-center gap-2 text-base font-semibold text-white">
                  <span role="img" aria-label={item.label}>{item.icon}</span>
                  {item.label}
                </p>
                <p className="mt-1 text-sm text-slate-300">{item.desc}</p>
              </div>
            ))}
          </div>
        </header>

        <section className="grid gap-6">
          <article
            className={`rounded-2xl border p-6 shadow-2xl ${cardClasses}`}
            role="region"
            aria-labelledby={screenshotHeadingId}
          >
            <h2 id={screenshotHeadingId} className="text-xl font-semibold flex items-center gap-2">
              <span className="text-2xl" role="img" aria-label="Input">🧩</span>
              Bring a screen or URL
            </h2>
            <p className={`mt-2 text-sm ${textMutedClasses}`}>
              Drag & drop a screenshot <strong>and/or</strong> paste a live URL. We&apos;ll ingest whichever
              sources you provide and immediately run the full analysis.
            </p>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <label
                onDragOver={(event) => event.preventDefault()}
                onDrop={onDrop}
                onKeyDown={handleDropKeyDown}
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    triggerFileDialog();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-describedby={fileHintId}
                aria-busy={isAnalyzing}
                className={`flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition hover:border-teal-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-500 ${
                  theme === "light" 
                    ? "border-slate-300 bg-slate-100 hover:bg-slate-200" 
                    : "border-slate-700 bg-slate-950/40 hover:bg-slate-900"
                }`}
              >
                <input
                  id={fileInputId}
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_FILE_TYPES.join(",")}
                  className="hidden"
                  aria-describedby={fileHintId}
                  onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
                />
                <span className="text-4xl mb-2" role="img" aria-label="Upload file">📁</span>
                <span className="text-lg font-medium">Drop your screen here</span>
                <span id={fileHintId} className={`mt-2 text-sm ${textMutedClasses}`}>
                  {fileHint}
                </span>
                <span className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                  Or press Enter/Space to pick a file
                </span>
              </label>

              <div className="space-y-4">
                <div className="space-y-3">
                  <label className={`text-xs font-semibold uppercase tracking-wide ${textMutedClasses}`} htmlFor={urlInputId}>
                    <span className="mr-1" role="img" aria-label="URL">🌐</span>
                    URL
                  </label>
                  <input
                    id={urlInputId}
                    className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 ${inputClasses}`}
                    placeholder="https://app.yourproduct.com/checkout"
                    value={urlInput}
                    onChange={(event) => setUrlInput(event.target.value)}
                    aria-describedby={urlHintId}
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                  <p id={urlHintId} className={`text-xs ${textSecondaryClasses}`}>
                    Paste any live experience. We&apos;ll fetch markup, attempt a screenshot, and blend it
                    with your uploaded screen if both are available.
                  </p>
                </div>

                <div className="space-y-3">
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-400 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={handleAnalyze}
                    disabled={(!file && !urlInput.trim()) || isAnalyzing}
                    aria-disabled={(!file && !urlInput.trim()) || isAnalyzing}
                    aria-describedby={runAnalysisHintId}
                  >
                    <span role="img" aria-hidden="true">{isAnalyzing ? "⏳" : "🚀"}</span>
                    {isAnalyzing ? "Analyzing…" : "Analyze now"}
                  </button>
                  <p id={runAnalysisHintId} className={`text-xs ${textSecondaryClasses}`}>
                    We run ingestion, heuristics, visual analysis, and LLM recommendations in one shot.
                  </p>
                  {statusMessage ? (
                    <p className="text-sm text-teal-600 dark:text-teal-300" role="status" aria-live="polite">
                      {statusMessage}
                    </p>
                  ) : null}
                  {error ? (
                    <div
                      id={errorRegionId}
                      role="alert"
                      aria-live="assertive"
                      className="rounded-xl border-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200"
                    >
                      <span className="mr-2" role="img" aria-label="Error">
                        ❌
                      </span>
                      {error}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </article>
        </section>

        {(isAnalyzing || response || metrics?.length || analysis) && (
          <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className={`rounded-2xl border p-6 shadow-inner ${cardClasses}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <span role="img" aria-label="Preview">👁️</span>
                Ingestion Preview
              </h3>
              <span className={`text-xs uppercase tracking-widest ${textSecondaryClasses}`}>STEP 1 OF 4</span>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className={`rounded-xl border p-3 ${
                theme === "light" ? "border-slate-300 bg-slate-100" : "border-slate-800 bg-black/40"
              }`}>
                <p className={`text-xs flex items-center gap-1 ${textMutedClasses}`}>
                  <span role="img" aria-label="Image">🖼️</span>
                  Visual Source
                </p>
                {preview ? (
                  <Image
                    src={preview}
                    alt="Uploaded preview"
                    width={640}
                    height={400}
                    className={`mt-2 rounded-lg border object-cover ${
                      theme === "light" ? "border-slate-300" : "border-slate-800"
                    }`}
                    unoptimized
                  />
                ) : (
                  <div className={`mt-2 flex h-48 items-center justify-center rounded-lg border border-dashed text-sm ${textSecondaryClasses} ${
                    theme === "light" ? "border-slate-300" : "border-slate-800"
                  }`}>
                    <span className="mr-2" role="img" aria-label="No image">📷</span>
                    No screenshot yet
                  </div>
                )}
              </div>
              <div className={`rounded-xl border p-3 ${
                theme === "light" ? "border-slate-300 bg-slate-100" : "border-slate-800 bg-black/40"
              }`}>
                <p className={`text-xs flex items-center gap-1 ${textMutedClasses}`}>
                  <span role="img" aria-label="Information">ℹ️</span>
                  Metadata
                </p>
                {response?.metadata ? (
                  <dl className={`mt-2 space-y-2 text-sm ${textSecondaryClasses}`}>
                    <div className="flex justify-between gap-2">
                      <span className={textMutedClasses}>📦 Source</span>
                      <span>{response.metadata.source}</span>
                    </div>
                    {response.metadata.url ? (
                      <div className="flex justify-between gap-2">
                        <span className={textMutedClasses}>🔗 URL</span>
                        <span className="truncate text-right">{response.metadata.url}</span>
                      </div>
                    ) : null}
                    {response.metadata.status ? (
                      <div className="flex justify-between gap-2">
                        <span className={textMutedClasses}>✅ Status</span>
                        <span>{response.metadata.status}</span>
                      </div>
                    ) : null}
                    {response.metadata.contentType ? (
                      <div className="flex justify-between gap-2">
                        <span className={textMutedClasses}>📄 Content</span>
                        <span>{response.metadata.contentType}</span>
                      </div>
                    ) : null}
                    {response.metadata.bytes ? (
                      <div className="flex justify-between gap-2">
                        <span className={textMutedClasses}>💾 Bytes</span>
                        <span>{response.metadata.bytes.toLocaleString()}</span>
                      </div>
                    ) : null}
                  </dl>
                ) : (
                  <p className={`mt-2 text-sm ${textSecondaryClasses}`}>
                    <span className="mr-1" role="img" aria-label="Info">ℹ️</span>
                    Run an upload or URL fetch to populate metadata.
                  </p>
                )}
              </div>
            </div>
            {response?.fetchedHtml ? (
              <div className={`mt-4 rounded-xl border p-4 ${
                theme === "light" ? "border-slate-300 bg-slate-100" : "border-slate-800 bg-black/30"
              }`}>
                <p className={`text-xs font-semibold uppercase flex items-center gap-1 ${textMutedClasses}`}>
                  <span role="img" aria-label="Code">💻</span>
                  HTML Snippet
                </p>
                <pre className={`mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs ${textSecondaryClasses}`}>
                  {response.fetchedHtml}
                </pre>
              </div>
            ) : null}
          </div>

          <aside className="space-y-4">
            {response?.warnings?.length ? (
              <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-100" role="alert" aria-live="polite">
                <p className="font-semibold flex items-center gap-1">
                  <span role="img" aria-label="Warning">⚠️</span>
                  Heads up
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {response.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {response?.note ? (
              <div className={`rounded-2xl border p-4 text-sm ${cardClasses}`}>
                <span className="mr-1" role="img" aria-label="Note">ℹ️</span>
                {response.note}
              </div>
            ) : null}
            <div className={`rounded-2xl border p-6 ${
              theme === "light" 
                ? "border-slate-200 bg-gradient-to-br from-slate-100 to-slate-50" 
                : "border-white/5 bg-gradient-to-br from-slate-900 to-slate-800"
            }`}>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <span role="img" aria-label="Next step">➡️</span>
                Next: Metrics
              </h3>
              <p className={`mt-2 text-sm ${textMutedClasses}`}>
                Once ingestion locks, we can pass the payload into five human metrics—readability,
                cognitive load, stress, memory burden, and empathy alignment.
              </p>
              <ol className={`mt-4 space-y-2 text-sm ${textSecondaryClasses}`}>
                <li className="flex items-center gap-2">
                  <span role="img" aria-label="Step 1">1️⃣</span>
                  Normalize the image + DOM snapshot
                </li>
                <li className="flex items-center gap-2">
                  <span role="img" aria-label="Step 2">2️⃣</span>
                  Feed heuristics &amp; visual features
                </li>
                <li className="flex items-center gap-2">
                  <span role="img" aria-label="Step 3">3️⃣</span>
                  Summon structured recommendations
                </li>
              </ol>
            </div>
          </aside>
        </section>
        )}

        {metrics?.length ? (
          <section className={`rounded-2xl border p-6 shadow-2xl ${cardClasses}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-teal-600 dark:text-teal-300 flex items-center gap-2">
                  <span role="img" aria-label="Scorecard">📊</span>
                  Human-centered scorecard
                </p>
                <h3 className="text-2xl font-semibold flex items-center gap-2">
                  <span role="img" aria-label="Metrics">📈</span>
                  Five-signal snapshot
                </h3>
              </div>
              {metricsTimestamp ? (
                <p className={`text-sm ${textMutedClasses}`}>
                  <span className="mr-1" role="img" aria-label="Generated">✨</span>
                  Generated {new Date(metricsTimestamp).toLocaleString()}
                </p>
              ) : null}
            </div>
            <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {metrics.map((metric) => (
                <article
                  key={metric.id}
                  className={`rounded-2xl border p-5 ${
                    theme === "light" 
                      ? "border-slate-300 bg-white" 
                      : "border-slate-800 bg-slate-950/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-xs uppercase tracking-widest flex items-center gap-1 ${textMutedClasses}`}>
                        <span className="text-lg" role="img" aria-label={metric.label}>
                          {metricIcons[metric.id] || "📋"}
                        </span>
                        {metric.label}
                      </p>
                      <h4 className="text-xl font-semibold">{metric.summary}</h4>
                    </div>
                    <span className="text-3xl font-bold text-teal-600 dark:text-teal-300">{metric.score}</span>
                  </div>
                  <div className={`mt-4 h-2 w-full rounded-full ${
                    theme === "light" ? "bg-slate-200" : "bg-slate-800"
                  }`}>
                    <div
                      className="h-full rounded-full bg-teal-500 transition-all"
                      style={{ width: `${metric.score}%` }}
                      role="progressbar"
                      aria-valuenow={metric.score}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${metric.label} score: ${metric.score}%`}
                    />
                  </div>
                  <div className={`mt-4 space-y-2 text-sm ${textSecondaryClasses}`}>
                    {metric.recommendations.length ? (
                      <ul className="list-disc space-y-1 pl-4">
                        {metric.recommendations.map((rec) => (
                          <li key={rec}>{rec}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="flex items-center gap-1">
                        <span role="img" aria-label="Good">✅</span>
                        Looks solid. Keep validating with user research.
                      </p>
                    )}
                  </div>
                  {Object.keys(metric.evidence).length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {Object.entries(metric.evidence).map(([key, value]) => (
                        <span
                          key={key}
                          className={`rounded-full border px-3 py-1 text-xs ${textMutedClasses} ${
                            theme === "light" ? "border-slate-300" : "border-slate-800"
                          }`}
                        >
                          {key}: {value as string | number}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {greenptData && !greenptData.errors ? (
          <section className={`rounded-2xl border p-6 shadow-2xl ${cardClasses}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-teal-600 dark:text-teal-300 flex items-center gap-2">
                  <span role="img" aria-label="Visual Analysis">👁️</span>
                  Visual Analysis
                </p>
                <h3 className="text-2xl font-semibold flex items-center gap-2">
                  <span role="img" aria-label="Scores">📊</span>
                  Visual Accessibility Score
                </h3>
              </div>
              {greenptData.overallScore !== undefined ? (
                <div className="text-right">
                  <p className={`text-xs ${textMutedClasses}`}>Overall score</p>
                  <p className="text-3xl font-bold text-teal-600 dark:text-teal-300 flex items-center justify-end gap-1">
                    {greenptData.overallScore}
                    <span className="text-lg">/100</span>
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {greenptData.contrast?.score !== undefined ? (
                <div className={`rounded-xl border p-4 ${
                  theme === "light" ? "border-slate-300 bg-white" : "border-slate-800 bg-slate-950/40"
                }`}>
                  <p className={`text-xs uppercase tracking-widest ${textMutedClasses}`}>Contrast</p>
                  <p className="text-2xl font-bold text-teal-600 dark:text-teal-300 mt-1">
                    {greenptData.contrast.score}/100
                  </p>
                  {greenptData.contrast.issues && greenptData.contrast.issues.length > 0 ? (
                    <p className={`text-xs mt-2 ${textSecondaryClasses}`}>
                      {greenptData.contrast.issues.length} issue{greenptData.contrast.issues.length !== 1 ? "s" : ""} found
                    </p>
                  ) : (
                    <p className={`text-xs mt-2 ${textSecondaryClasses}`}>✅ No issues</p>
                  )}
                </div>
              ) : null}
              {greenptData.layout?.complexity !== undefined ? (
                <div className={`rounded-xl border p-4 ${
                  theme === "light" ? "border-slate-300 bg-white" : "border-slate-800 bg-slate-950/40"
                }`}>
                  <p className={`text-xs uppercase tracking-widest ${textMutedClasses}`}>Layout Complexity</p>
                  <p className="text-2xl font-bold text-teal-600 dark:text-teal-300 mt-1">
                    {greenptData.layout.complexity}/100
                  </p>
                  <p className={`text-xs mt-2 ${textSecondaryClasses}`}>
                    {greenptData.layout.complexity < 50 ? "✅ Simple" : greenptData.layout.complexity < 75 ? "⚠️ Moderate" : "🔴 Complex"}
                  </p>
                </div>
              ) : null}
              {greenptData.layout?.visualHierarchy !== undefined ? (
                <div className={`rounded-xl border p-4 ${
                  theme === "light" ? "border-slate-300 bg-white" : "border-slate-800 bg-slate-950/40"
                }`}>
                  <p className={`text-xs uppercase tracking-widest ${textMutedClasses}`}>Visual Hierarchy</p>
                  <p className="text-2xl font-bold text-teal-600 dark:text-teal-300 mt-1">
                    {greenptData.layout.visualHierarchy}/100
                  </p>
                  <p className={`text-xs mt-2 ${textSecondaryClasses}`}>
                    {greenptData.layout.visualHierarchy > 70 ? "✅ Clear" : greenptData.layout.visualHierarchy > 50 ? "⚠️ Moderate" : "🔴 Unclear"}
                  </p>
                </div>
              ) : null}
            </div>

            {greenptData.layout?.focusableElements !== undefined ? (
              <div className={`mt-4 rounded-xl border p-4 ${
                theme === "light" ? "border-slate-300 bg-slate-100" : "border-slate-800 bg-slate-950/40"
              }`}>
                <p className={`text-sm ${textSecondaryClasses}`}>
                  <span className="font-semibold">Focusable elements:</span> {greenptData.layout.focusableElements}
                </p>
              </div>
            ) : null}
          </section>
        ) : null}

        {analysis ? (
          <section className={`rounded-2xl border p-6 shadow-2xl ${cardClasses}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-teal-600 dark:text-teal-300 flex items-center gap-2">
                  <span role="img" aria-label="AI">🤖</span>
                  AI-powered recommendations
                </p>
                <h3 className="text-2xl font-semibold flex items-center gap-2">
                  <span role="img" aria-label="Insights">💡</span>
                  Actionable insights
                </h3>
              </div>
              <div className="text-right">
                <p className={`text-xs ${textMutedClasses}`}>Overall score</p>
                <p className="text-3xl font-bold text-teal-600 dark:text-teal-300 flex items-center justify-end gap-1">
                  {analysis.overallScore}
                  <span className="text-lg">/100</span>
                </p>
              </div>
            </div>

            <div className={`mt-6 rounded-xl border p-4 ${
              theme === "light" 
                ? "border-slate-300 bg-slate-100" 
                : "border-slate-800 bg-slate-950/40"
            }`}>
              <p className={`text-sm ${textSecondaryClasses}`}>{analysis.summary}</p>
            </div>

            {analysis.topIssues.length > 0 ? (
              <div className="mt-6">
                <h4 className="text-lg font-semibold flex items-center gap-2">
                  <span role="img" aria-label="Issues">⚠️</span>
                  Top issues
                </h4>
                <ul className="mt-3 space-y-2">
                  {analysis.topIssues.map((issue, idx) => (
                    <li
                      key={idx}
                      className={`flex items-start gap-3 rounded-lg border p-3 ${
                        theme === "light"
                          ? "border-slate-300 bg-white"
                          : "border-slate-800 bg-slate-950/40"
                      }`}
                    >
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold flex items-center gap-1 ${
                          issue.severity === "high"
                            ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                            : issue.severity === "medium"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                              : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {issue.severity === "high" ? "🔴" : issue.severity === "medium" ? "🟡" : "🟢"}
                        {issue.severity}
                      </span>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${textSecondaryClasses}`}>{issue.metric}</p>
                        <p className={`text-sm ${textMutedClasses}`}>{issue.issue}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {analysis.recommendations.length > 0 ? (
              <div className="mt-6">
                <h4 className="text-lg font-semibold flex items-center gap-2">
                  <span role="img" aria-label="Recommendations">💡</span>
                  Recommendations
                </h4>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  {analysis.recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg border p-4 ${
                        theme === "light"
                          ? "border-slate-300 bg-white"
                          : "border-slate-800 bg-slate-950/40"
                      }`}
                    >
                      <div className="mb-2 flex items-center gap-2 flex-wrap">
                        <h5 className="font-semibold">{rec.title}</h5>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs flex items-center gap-1 ${
                            rec.impact === "high"
                              ? "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300"
                              : rec.impact === "medium"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                                : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {rec.impact === "high" ? "⚡" : rec.impact === "medium" ? "📊" : "📝"}
                          {rec.impact} impact
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs flex items-center gap-1 ${
                            rec.effort === "quick"
                              ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300"
                              : rec.effort === "medium"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                                : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {rec.effort === "quick" ? "⚡" : rec.effort === "medium" ? "⏱️" : "📅"}
                          {rec.effort}
                        </span>
                      </div>
                      <p className={`text-sm ${textSecondaryClasses}`}>{rec.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* Footer with GreenPT logo */}
        <footer className="mt-12 pt-8 border-t border-slate-300 dark:border-slate-800">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <p className={`text-sm ${textSecondaryClasses} flex items-center gap-2`}>
              <span role="img" aria-label="Sustainable AI">🌱</span>
              Powered by sustainable AI via
            </p>
            <a
              href="https://greenpt.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 rounded"
              aria-label="GreenPT - Sustainable AI Platform"
            >
              <img
                src="/logo-greengpt-black@2x.webp"
                alt="GreenPT"
                className={`h-6 ${theme === "dark" ? "brightness-0 invert" : ""}`}
              />
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
