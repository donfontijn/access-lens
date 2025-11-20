import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium-min";

type IngestPayload = {
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

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_HTML_CHARS = 40_000;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const screenshot = formData.get("screenshot");
    const rawUrl = (formData.get("url") ?? "").toString().trim();

    if (!screenshot && !rawUrl) {
      return NextResponse.json(
        { error: "Provide a screenshot or a URL to ingest." },
        { status: 400 },
      );
    }

    const payload: IngestPayload = { warnings: [] };

    if (screenshot instanceof File) {
      const arrayBuffer = await screenshot.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      payload.screenshotDataUrl = `data:${screenshot.type || "image/png"};base64,${base64}`;
      payload.metadata = {
        ...(payload.metadata ?? {}),
        source: "upload",
        bytes: screenshot.size,
      };
    }

    if (rawUrl) {
      let normalizedUrl = rawUrl;
      if (!/^https?:\/\//i.test(normalizedUrl)) {
        normalizedUrl = `https://${normalizedUrl}`;
      }

      try {
        const parsed = new URL(normalizedUrl);
        normalizedUrl = parsed.toString();
      } catch {
        payload.warnings?.push("Provided URL is invalid. Skipping remote fetch.");
        normalizedUrl = "";
      }

      if (normalizedUrl) {
        try {
          console.log(`Fetching URL: ${normalizedUrl}`);
          const response = await fetch(normalizedUrl, {
            headers: {
              "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
              "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
            redirect: "follow",
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const contentType = response.headers.get("content-type") || "";
          console.log(`Response status: ${response.status}, Content-Type: ${contentType}`);
          
          payload.metadata = {
            ...(payload.metadata ?? {}),
            source: payload.metadata?.source ?? "url",
            url: normalizedUrl,
            status: response.status,
            contentType,
          };

          if (contentType.startsWith("image/")) {
            const buffer = Buffer.from(await response.arrayBuffer());
            payload.screenshotDataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
            payload.metadata.bytes = buffer.byteLength;
            console.log(`Fetched image: ${buffer.byteLength} bytes`);
          } else {
            const text = await response.text();
            payload.fetchedHtml = text.slice(0, MAX_HTML_CHARS);
            console.log(`Fetched HTML: ${payload.fetchedHtml.length} characters`);
            
            // Generate screenshot from HTML page
            try {
              console.log(`Generating screenshot for ${normalizedUrl}...`);
              
              // Use serverless-optimized Chromium for Vercel, installed Chrome for local dev
              const isVercel = process.env.VERCEL === "1";
              let executablePath: string | undefined;
              let launchArgs: string[];
              
              if (isVercel) {
                // Vercel: use minimal Chromium optimized for serverless
                executablePath = await chromium.executablePath();
                launchArgs = chromium.args;
              } else {
                // Local dev: use installed Chrome or system Chrome
                executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
                launchArgs = [
                  '--no-sandbox',
                  '--disable-setuid-sandbox',
                  '--disable-dev-shm-usage',
                ];
              }
              
              const browser = await puppeteer.launch({
                args: launchArgs,
                executablePath,
                headless: chromium.headless,
                defaultViewport: chromium.defaultViewport,
              });
              const page = await browser.newPage();
              await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

              await page.goto(normalizedUrl, {
                waitUntil: ['domcontentloaded', 'networkidle2'],
                timeout: 30000,
              });

              const screenshot = await page.screenshot({ type: 'png', encoding: 'base64' });
              await browser.close();
              
              payload.screenshotDataUrl = `data:image/png;base64,${screenshot}`;
              console.log(`Generated screenshot: ${typeof screenshot === 'string' ? screenshot.length : 'buffer'} bytes`);
            } catch (screenshotError) {
              console.warn(`Screenshot generation failed for ${normalizedUrl}:`, screenshotError);
              payload.warnings?.push(
                `Could not generate screenshot: ${screenshotError instanceof Error ? screenshotError.message : 'Unknown error'}. HTML analysis will still work.`,
              );
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.warn(`Fetch attempt failed for ${normalizedUrl}`, error);
          payload.warnings?.push(
            `Could not fetch ${normalizedUrl}: ${errorMessage}. This might be due to CORS restrictions or network issues.`,
          );
          payload.metadata = {
            ...(payload.metadata ?? {}),
            source: payload.metadata?.source ?? "placeholder",
            url: normalizedUrl,
          };
          payload.error = `Failed to fetch URL: ${errorMessage}`;
        }
      }
    }

    if (!payload.screenshotDataUrl) {
      payload.note =
        "No screenshot detected. You can still run textual analysis, but visual metrics will be limited.";
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Ingestion error", error);
    return NextResponse.json(
      { error: "Failed to process ingestion request." },
      { status: 500 },
    );
  }
}
