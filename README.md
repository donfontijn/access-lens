# Digital Accessibility Evaluator

A practical tool for designers to evaluate accessibility from a human-centered perspective. Not a compliance checklist—real insights about readability, cognitive load, user stress, memory burden, and empathy alignment.

## Features

- **Screenshot Upload**: Drag and drop high-fidelity mocks or production screens
- **URL Capture**: Point at a live URL to fetch and analyze markup
- **Five Human Metrics**: 
  - Readability (sentence structure, hierarchy)
  - Cognitive Load (component complexity, interaction density)
  - User Stress (warning language, error cues)
  - Memory Burden (form fields, step indicators)
  - Empathy Alignment (supportive language, jargon detection)
- **Greenpt Integration**: Visual analysis for contrast, layout complexity, and focusable elements
- **AI-Powered Recommendations**: LLM-generated actionable insights with impact/effort prioritization

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure API keys** (optional but recommended):
   Create a `.env.local` file in the root directory:
   ```bash
   # Greenpt API (for visual analysis)
   GREENPT_API_KEY=your_greenpt_api_key_here
   GREENPT_BASE_URL=https://api.greenpt.ai

   # OpenAI API (for LLM recommendations)
   OPENAI_API_KEY=your_openai_api_key_here
   ```

   **Note**: The tool works without API keys—it will use heuristic-only analysis with fallback recommendations. For best results, configure both.

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open** [http://localhost:3000](http://localhost:3000)

## How It Works

1. **Ingest**: Upload a screenshot or provide a URL
2. **Analyze**: The system runs:
   - Heuristic metrics on HTML structure
   - Greenpt visual analysis (if API key configured)
   - LLM-powered synthesis (if OpenAI key configured)
3. **Recommend**: Get prioritized, actionable design recommendations

## Architecture

- **Frontend**: Next.js 16 with React 19, TypeScript, Tailwind CSS
- **API Routes**:
  - `/api/ingest` - Handles screenshot uploads and URL fetching
  - `/api/metrics` - Runs heuristic metric calculations
  - `/api/analyze` - Orchestrates full analysis pipeline (heuristics + Greenpt + LLM)
- **Libraries**:
  - `src/lib/metrics.ts` - Five heuristic metric calculators
  - `src/lib/greenpt.ts` - Greenpt API client
  - `src/lib/llm-analysis.ts` - LLM recommendation generator

## Getting API Keys

- **Greenpt**: Visit [https://docs.greenpt.ai/](https://docs.greenpt.ai/) for API documentation and key registration
- **OpenAI**: Get your API key from [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)

## Build for Production

```bash
npm run build
npm start
```

## License

MIT
