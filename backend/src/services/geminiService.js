import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.js";

export class GeminiService {
  constructor(logger) {
    this.logger = logger;
    this.enabled = Boolean(config.geminiApiKey);
    this.model = null;

    if (this.enabled) {
      const client = new GoogleGenerativeAI(config.geminiApiKey);
      this.model = client.getGenerativeModel({ model: config.geminiModel });
    }
  }

  async chooseFieldMapping(fields) {
    if (!this.enabled) {
      this.logger.warn("Gemini API key not configured; using local field matching.");
      return null;
    }

    try {
      const prompt = `
You are helping a browser automation agent map form fields.
Return only compact JSON in this shape:
{"nameFieldId":"...", "descriptionFieldId":"..."}

Fields:
${JSON.stringify(fields, null, 2)}
`;

      const result = await this.model.generateContent(prompt);
      const text = result.response.text().trim();
      const jsonText = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      return JSON.parse(jsonText);
    } catch (error) {
      this.logger.warn("Gemini field mapping failed; falling back to local heuristics.", {
        error: error.message
      });
      return null;
    }
  }

  async summarizeTravelResults({ searchType, searchInput, results }) {
    if (!this.enabled) {
      this.logger.warn("Gemini API key not configured; returning local recommendation summary.");
      return createLocalSummary(searchType, results);
    }

    try {
      const prompt = `
You are a travel search assistant. Analyze these extracted ${searchType} results and return only compact JSON.
Use this shape:
{
  "cheapest":"short text",
  "bestRated":"short text",
  "recommended":"short text",
  "summary":"2-3 concise sentences"
}

Search input:
${JSON.stringify(searchInput, null, 2)}

Extracted results:
${JSON.stringify(results, null, 2)}
`;

      const result = await this.model.generateContent(prompt);
      const text = result.response.text().trim();
      const jsonText = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      return JSON.parse(jsonText);
    } catch (error) {
      this.logger.warn("Gemini recommendation failed; using local summary.", {
        error: error.message
      });
      return createLocalSummary(searchType, results);
    }
  }
}

function createLocalSummary(searchType, results) {
  const cheapest = [...results]
    .filter((result) => Number.isFinite(result.priceValue))
    .sort((a, b) => a.priceValue - b.priceValue)[0];

  const bestRated = [...results]
    .filter((result) => Number.isFinite(result.ratingValue))
    .sort((a, b) => b.ratingValue - a.ratingValue)[0];

  const recommended = bestRated || cheapest || results[0];

  return {
    cheapest: cheapest ? formatResultLine(cheapest) : "No clear cheapest option found.",
    bestRated: bestRated ? formatResultLine(bestRated) : "No clear rating information found.",
    recommended: recommended ? formatResultLine(recommended) : "No recommendation available.",
    summary: results.length
      ? `Found ${results.length} ${searchType} result samples. Review the live website before booking because prices and availability can change.`
      : "No structured result samples were extracted from the page."
  };
}

function formatResultLine(result) {
  return [result.title, result.price, result.rating].filter(Boolean).join(" | ");
}
