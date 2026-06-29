import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import { AgentError } from "../utils/errors.js";

chromium.use(stealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotsDir = path.resolve(__dirname, "../../screenshots");

export class BrowserTools {
  constructor({ logger, headless = false }) {
    this.logger = logger;
    this.headless = headless;
    this.browser = null;
    this.page = null;
  }

  async open_browser() {
    this.logger.info("Opening browser", { headless: this.headless });
    this.browser = await chromium.launch({ headless: this.headless, slowMo: 80 });
    const context = await this.browser.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1
    });
    this.page = await context.newPage();
    return this.page;
  }

  async navigate_to_url(url) {
    this.ensurePage();
    this.logger.info("Navigating to URL", { url });
    await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await this.page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => {
      this.logger.warn("Network did not become fully idle; continuing with loaded DOM.");
    });
  }

  async take_screenshot(label = "screenshot") {
    this.ensurePage();
    const safeLabel = label.replace(/[^a-z0-9-_]/gi, "_").toLowerCase();
    const fileName = `${Date.now()}-${safeLabel}.png`;
    const filePath = path.join(screenshotsDir, fileName);
    await fs.mkdir(screenshotsDir, { recursive: true });
    await this.page.screenshot({ path: filePath, fullPage: true });
    this.logger.info("Screenshot captured", { fileName });
    return { fileName, filePath, url: `/screenshots/${fileName}` };
  }

  async click_on_screen(x, y) {
    this.ensurePage();
    this.logger.info("Clicking screen coordinate", { x, y });
    await this.page.mouse.click(x, y);
  }

  async double_click(x, y) {
    this.ensurePage();
    this.logger.info("Double-clicking screen coordinate", { x, y });
    await this.page.mouse.dblclick(x, y);
  }

  async send_keys(text) {
    this.ensurePage();
    this.logger.info("Sending keys", { length: text.length });
    await this.page.keyboard.type(text, { delay: 15 });
  }

  async scroll(deltaY = 700) {
    this.ensurePage();
    this.logger.info("Scrolling page", { deltaY });
    await this.page.mouse.wheel(0, deltaY);
    await this.page.waitForTimeout(400);
  }

  async extract_results(searchType) {
    this.ensurePage();
    this.logger.info("Extracting visible travel results", { searchType });

    const rawResults = await this.page.evaluate((type) => {
      const selectorGroups = {
        flights: [
          "[data-testid*='itinerary']",
          "[data-testid*='flight']",
          "[class*='Itinerary']",
          "[class*='Flight']",
          "[class*='Result']"
        ],
        hotels: [
          "[data-testid='property-card']",
          "[data-testid*='property-card']",
          "[data-testid*='property']",
          "[class*='property-card']",
          "[class*='sr_property_block']"
        ],
        dummy: [
          "table.table tbody tr"
        ]
      };

      const selectors = selectorGroups[type] || [];
      const nodes = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
      const uniqueNodes = [...new Set(nodes)].filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && node.textContent.trim().length > 20;
      });

      if (uniqueNodes.length) {
        return uniqueNodes.slice(0, 10).map((node) => node.textContent.replace(/\s+/g, " ").trim());
      }

      const pageText = document.body.innerText.replace(/\s+/g, " ").trim();
      const priceBlocks = pageText.split(/(?=₹|Rs\.?|INR|\$|US\$)/i);
      return priceBlocks
        .map((block) => block.trim())
        .filter((block) => block.length > 40)
        .slice(0, 10);
    }, searchType);

    return rawResults.map((text, index) => parseTravelResult(text, searchType, index));
  }

  async close() {
    if (this.browser) {
      this.logger.info("Closing browser");
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  ensurePage() {
    if (!this.page) {
      throw new AgentError("Browser page is not initialized. Call open_browser first.");
    }
  }
}

function parseTravelResult(text, searchType, index) {
  const price = text.match(/(?:₹|Rs\.?|INR|US\$|\$)\s?[\d,]+(?:\.\d{1,2})?/i)?.[0] || "";
  const rating = text.match(/\b(?:[1-9](?:\.\d)?|10)(?:\s?\/\s?10|\s?stars?|\s?out of\s?10)?\b/i)?.[0] || "";
  const timeRange = text.match(/\b\d{1,2}:\d{2}\s?(?:AM|PM|am|pm)?\b.*?\b\d{1,2}:\d{2}\s?(?:AM|PM|am|pm)?\b/)?.[0] || "";
  const title = text
    .split(/₹|Rs\.?|INR|US\$|\$/i)[0]
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
  const priceValue = price ? Number(price.replace(/[^\d.]/g, "")) : null;
  const ratingValue = rating ? Number(rating.match(/\d+(?:\.\d+)?/)?.[0]) : null;

  return {
    id: `${searchType}-${index + 1}`,
    type: searchType,
    title: title || `Result ${index + 1}`,
    price,
    priceValue,
    rating,
    ratingValue,
    timeRange,
    rawText: text.slice(0, 700)
  };
}
