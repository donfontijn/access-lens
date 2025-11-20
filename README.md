# Access Lens 🔍

**See your design through everyone's eyes.**

Access Lens is a human-centered accessibility evaluator that goes beyond compliance checklists. Upload a screenshot or drop a URL, and get real insights about how your design feels—not just whether it passes automated tests.

✨ **What makes it different?**
- 🧠 Measures **cognitive load** and **user stress**—the invisible barriers
- 📖 Analyzes **readability** and **memory burden**—how easy is it to actually use?
- ❤️ Evaluates **empathy alignment**—does your language welcome everyone?
- 👁️ **Visual analysis** powered by sustainable AI for contrast, layout, and focus flow
- 🤖 **AI-powered recommendations** that prioritize impact and effort

**Not just accessible. Actually usable.**

## Features

- **Screenshot Upload**: Drag and drop high-fidelity mocks or production screens
- **URL Capture**: Point at a live URL to fetch and analyze markup
- **Five Human Metrics**: 
  - Readability (sentence structure, hierarchy)
  - Cognitive Load (component complexity, interaction density)
  - User Stress (warning language, error cues)
  - Memory Burden (form fields, step indicators)
  - Empathy Alignment (supportive language, jargon detection)
- **GreenPT Integration**: Visual analysis and AI-powered recommendations for contrast, layout complexity, and actionable insights

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure API keys** (optional but recommended):
   Create a `.env.local` file in the root directory:
   ```bash
   # GreenPT API (for visual analysis and LLM recommendations)
   GREENPT_API_KEY=your_greenpt_api_key_here
   GREENPT_BASE_URL=https://api.greenpt.ai
   # Puppeteer cache directory (helps Vercel/local CI reuse Chrome)
   PUPPETEER_CACHE_DIR=./.cache/puppeteer
   ```

   **Note**: The tool works without API keys—it will use heuristic-only analysis with fallback recommendations. For best results, configure the GreenPT API key.

3. **Install headless Chrome for Puppeteer**:
   ```bash
   npm run postinstall
   ```
   This command runs automatically on `npm install`, and downloads the Chromium build Puppeteer needs. On hosting providers (e.g. Vercel) this happens during the build step as well.
   - **Vercel tip**: define `PUPPETEER_CACHE_DIR=/tmp/puppeteer` in the project environment variables so the download is cached between builds.

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open** [http://localhost:3000](http://localhost:3000)

## How It Works

1. **Ingest**: Upload a screenshot or provide a URL
2. **Analyze**: The system runs:
   - Heuristic metrics on HTML structure
   - GreenPT visual analysis and LLM-powered synthesis (if API key configured)
3. **Recommend**: Get prioritized, actionable design recommendations

## Architecture

- **Frontend**: Next.js 16 with React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes with Puppeteer for DOM snapshots
- **AI Platform**: GreenPT API for visual analysis and LLM-powered recommendations
- **API Routes**:
  - `/api/ingest` - Handles screenshot uploads and URL fetching
  - `/api/metrics` - Runs heuristic metric calculations
  - `/api/analyze` - Orchestrates full analysis pipeline (heuristics + GreenPT visual analysis + GreenPT LLM recommendations)
- **Libraries**:
  - `src/lib/metrics.ts` - Five heuristic metric calculators
  - `src/lib/greenpt.ts` - GreenPT API client for visual analysis
  - `src/lib/llm-analysis.ts` - GreenPT-powered LLM recommendation generator

## Getting API Keys

- **GreenPT**: Visit [https://docs.greenpt.ai/](https://docs.greenpt.ai/) for API documentation and key registration

## Build for Production

```bash
npm run build
npm start
```

## License

MIT
