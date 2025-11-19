type GreenptConfig = {
  apiKey?: string;
  baseUrl?: string;
};

type GreenptAnalysisRequest = {
  image?: string;
  html?: string;
  url?: string;
};

type GreenptAnalysisResponse = {
  contrast?: {
    score?: number;
    issues?: Array<{ element?: string; ratio?: number; level?: string }>;
  };
  textExtraction?: {
    text?: string;
    headings?: string[];
    links?: string[];
  };
  layout?: {
    complexity?: number;
    focusableElements?: number;
    visualHierarchy?: number;
  };
  overallScore?: number;
  errors?: string[];
};

export async function analyzeWithGreenpt(
  input: GreenptAnalysisRequest,
  config: GreenptConfig = {},
): Promise<GreenptAnalysisResponse> {
  const apiKey = config.apiKey ?? process.env.GREENPT_API_KEY;
  const baseUrl = config.baseUrl ?? process.env.GREENPT_BASE_URL ?? "https://api.greenpt.ai";

  console.log("[Greenpt] API key present:", !!apiKey, "Base URL:", baseUrl);
  console.log("[Greenpt] Input has:", {
    image: !!input.image,
    html: !!input.html,
    url: !!input.url,
  });

  if (!apiKey) {
    console.warn("Greenpt API key not configured. Skipping Greenpt analysis.");
    return {};
  }

  try {
    // Build content array for chat completions format
    const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
    
    // Add image first if available
    if (input.image) {
      content.push({ type: "image_url", image_url: { url: input.image } });
    }
    
    // Build the prompt text - request structured JSON analysis
    let promptText = `You are an accessibility analysis expert. Analyze this web interface comprehensively and provide a detailed JSON response.

Analyze the following:
1. **Visual Contrast**: Check color contrast ratios, identify low-contrast text/elements, score from 0-100
2. **Layout Complexity**: Assess visual hierarchy, spacing, information density, score from 0-100
3. **Focusable Elements**: Count and evaluate interactive elements, keyboard navigation paths
4. **Text Structure**: Extract headings hierarchy, links, and text organization
5. **Overall Accessibility Score**: 0-100 based on all factors

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "contrast": {
    "score": <number 0-100>,
    "issues": [{"element": "<description>", "ratio": <number>, "level": "<AA|AAA|fail>"}]
  },
  "layout": {
    "complexity": <number 0-100, lower is better>,
    "focusableElements": <number>,
    "visualHierarchy": <number 0-100, higher is better>
  },
  "textExtraction": {
    "text": "<main text content>",
    "headings": ["<h1>", "<h2>", ...],
    "links": ["<link text>", ...]
  },
  "overallScore": <number 0-100>
}

`;
    
    if (input.url) {
      promptText += `\nURL to analyze: ${input.url}\n`;
    }
    if (input.html) {
      promptText += `\nHTML Content (first 8000 chars):\n${input.html.slice(0, 8000)}\n`;
    }
    if (input.image) {
      promptText += `\nA screenshot of the interface is provided above. Analyze the visual design, contrast, and layout from the image.\n`;
    }
    
    promptText += `\nNow provide your analysis as JSON only:`;
    
    content.push({ type: "text", text: promptText });

    const payload = {
      model: "green-l",
      messages: [
        {
          role: "user",
          content: content.length > 0 ? content : [{ type: "text", text: "Analyze for accessibility" }],
        },
      ],
      stream: false,
    };

    console.log("[Greenpt] Calling API:", `${baseUrl}/v1/chat/completions`);
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    console.log("[Greenpt] Response status:", response.status);
    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.warn(`Greenpt API error (${response.status}):`, errorText);
      return { errors: [`Greenpt API returned ${response.status}`] };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    
    console.log("[Greenpt] Success! Got response");
    
    // Extract the text content from chat completion
    const responseText = data.choices?.[0]?.message?.content || "";
    
    // Try to extract JSON from the response (might be wrapped in markdown code blocks)
    let jsonText = responseText.trim();
    
    // Remove markdown code blocks if present
    jsonText = jsonText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
    
    // Try to find JSON object in the text
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }
    
    // Parse the JSON response
    let parsedData: GreenptAnalysisResponse = {};
    try {
      parsedData = JSON.parse(jsonText) as GreenptAnalysisResponse;
      console.log("[Greenpt] Successfully parsed JSON response");
      console.log("[Greenpt] Overall score:", parsedData.overallScore);
      console.log("[Greenpt] Contrast score:", parsedData.contrast?.score);
      console.log("[Greenpt] Layout complexity:", parsedData.layout?.complexity);
    } catch (parseError) {
      console.warn("[Greenpt] Failed to parse JSON, response was:", responseText.slice(0, 200));
      // Fallback: try to extract scores from text
      const scoreMatch = responseText.match(/overallScore["\s:]+(\d+)/i) || 
                        responseText.match(/overall.*score["\s:]+(\d+)/i);
      if (scoreMatch) {
        parsedData = {
          overallScore: parseInt(scoreMatch[1], 10),
          textExtraction: { text: responseText },
        };
      } else {
        parsedData = {
          textExtraction: { text: responseText },
          errors: ["Could not parse structured response from Greenpt"],
        };
      }
    }
    
    console.log("[Greenpt] Final parsed data keys:", Object.keys(parsedData));
    return parsedData;
  } catch (error) {
    console.warn("Greenpt API call failed:", error);
    return { errors: ["Greenpt service unavailable"] };
  }
}
