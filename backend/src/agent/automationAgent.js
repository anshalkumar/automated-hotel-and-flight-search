import { config } from "../config.js";
import { GeminiService } from "../services/geminiService.js";
import { AgentError } from "../utils/errors.js";
import { AgentLogger } from "../utils/logger.js";
import { BrowserTools } from "./browserTools.js";
import { detectFormFields, chooseFieldsWithHeuristics } from "./elementDetector.js";

export class WebsiteAutomationAgent {
  constructor(options = {}) {
    this.logger = new AgentLogger();
    this.tools = new BrowserTools({
      logger: this.logger,
      headless: options.headless ?? config.headless
    });
    this.gemini = new GeminiService(this.logger);
  }

  async run(input) {
    const screenshots = [];

    try {
      await this.tools.open_browser();

      const searchType = input.searchType;
      const searchInput = normalizeSearchInput(input);
      const url = 
        searchType === "flights" 
          ? config.skyscannerUrl 
          : searchType === "dummy" 
          ? "https://blazedemo.com" 
          : searchType === "shadcn"
          ? "https://ui.shadcn.com/docs/forms/react-hook-form"
          : config.bookingUrl;

      await this.tools.navigate_to_url(url);
      await this.acceptPopups();
      screenshots.push(await this.tools.take_screenshot(`${searchType}-page-loaded`));

      if (searchType === "flights") {
        await this.searchFlights(searchInput);
      } else if (searchType === "hotels") {
        await this.searchHotels(searchInput);
      } else if (searchType === "dummy") {
        await this.searchDummy(searchInput);
      } else if (searchType === "shadcn") {
        await this.searchShadcn(searchInput);
      }

      screenshots.push(await this.tools.take_screenshot(`${searchType}-search-started`));
      
      if (searchType !== "shadcn") {
        await this.waitForResults(searchType);
        await this.failIfAccessBlocked(searchType);
        await this.collectMoreResults();
      }

      const results = searchType === "shadcn" ? [
        {
          id: "shadcn-1",
          type: "shadcn",
          title: "Form Field Mapping Summary",
          price: "",
          rating: "",
          timeRange: "",
          rawText: `Successfully identified Name and Description elements. Filled Name with: "${searchInput.source}" and Description with: "${searchInput.destination}"`
        }
      ] : await this.tools.extract_results(searchType);

      const recommendation = searchType === "shadcn" ? {
        cheapest: "N/A",
        bestRated: "N/A",
        recommended: "N/A",
        summary: `The automation agent navigated to the Shadcn documentation page, detected form fields, dynamically mapped the input fields using Gemini / heuristics, filled Name with "${searchInput.source}", Description with "${searchInput.destination}", and submitted the form.`
      } : await this.gemini.summarizeTravelResults({
        searchType,
        searchInput,
        results
      });

      screenshots.push(await this.tools.take_screenshot(`${searchType}-results`));
      this.logger.info("Travel automation task completed successfully", {
        resultCount: results.length
      });

      return {
        success: true,
        searchType,
        searchInput,
        visitedUrl: this.tools.page.url(),
        results,
        recommendation,
        screenshots,
        logs: this.logger.list()
      };
    } catch (error) {
      this.logger.error("Travel automation task failed", {
        message: error.message,
        details: error.details || {}
      });

      try {
        screenshots.push(await this.tools.take_screenshot("error-state"));
      } catch {
        this.logger.warn("Could not capture error screenshot.");
      }

      throw Object.assign(error, {
        result: {
          success: false,
          screenshots,
          logs: this.logger.list()
        }
      });
    } finally {
      await this.tools.close();
    }
  }

  async searchFlights(input) {
    this.logger.info("Starting Skyscanner India flight search", {
      source: input.source,
      destination: input.destination,
      departureDate: input.departureDate
    });

    const page = this.tools.page;
    const interacted = await this.tryFlightHomePageInteraction(input);

    if (!interacted) {
      this.logger.warn("Skyscanner UI interaction was incomplete; using URL fallback.");
      await this.tools.navigate_to_url(buildSkyscannerSearchUrl(input));
      return;
    }

    const searchClicked = await this.tryClickByRoleOrText(["Search", "Search flights", "Explore"]);
    if (!searchClicked) {
      this.logger.warn("Could not locate Skyscanner search button; using URL fallback.");
      await this.tools.navigate_to_url(buildSkyscannerSearchUrl(input));
      return;
    }

    await page.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2500);

    if (isSameBaseUrl(page.url(), config.skyscannerUrl)) {
      this.logger.warn("Skyscanner did not navigate after search click; using URL fallback.");
      await this.tools.navigate_to_url(buildSkyscannerSearchUrl(input));
    }
  }

  async tryFlightHomePageInteraction(input) {
    const fromFilled = await this.tryFillField(
      [
        { type: "label", value: "From" },
        { type: "placeholder", value: "From" },
        { type: "selector", value: "input[name*='origin' i]" },
        { type: "selector", value: "input[aria-label*='from' i]" }
      ],
      input.source
    );

    const toFilled = await this.tryFillField(
      [
        { type: "label", value: "To" },
        { type: "placeholder", value: "To" },
        { type: "selector", value: "input[name*='destination' i]" },
        { type: "selector", value: "input[aria-label*='to' i]" }
      ],
      input.destination
    );

    const departureFilled = await this.tryFillField(
      [
        { type: "label", value: "Depart" },
        { type: "placeholder", value: "Depart" },
        { type: "selector", value: "input[type='date']" }
      ],
      input.departureDate,
      { pressEnter: false }
    );

    if (input.returnDate) {
      const returnFilled = await this.tryFillField(
        [
          { type: "label", value: "Return" },
          { type: "placeholder", value: "Return" }
        ],
        input.returnDate,
        { pressEnter: false }
      );

      return fromFilled && toFilled && departureFilled && returnFilled;
    }

    return fromFilled && toFilled && departureFilled;
  }

  async searchHotels(input) {
    this.logger.info("Starting Booking.com hotel search", {
      destination: input.destination,
      checkIn: input.checkIn,
      checkOut: input.checkOut
    });

    const interacted = await this.tryHotelHomePageInteraction(input);
    const searchClicked = interacted && (await this.tryClickByRoleOrText(["Search", "Find", "Submit"]));

    if (!searchClicked) {
      this.logger.warn("Booking.com UI interaction was incomplete; using URL fallback.");
      await this.tools.navigate_to_url(buildBookingSearchUrl(input));
    }
  }

  async searchDummy(input) {
    this.logger.info("Starting BlazeDemo flight search", {
      source: input.source,
      destination: input.destination
    });
    
    const page = this.tools.page;
    await page.selectOption('select[name="fromPort"]', input.source).catch(() => {});
    await page.selectOption('select[name="toPort"]', input.destination).catch(() => {});
    
    const searchClicked = await this.tryClickByRoleOrText(["Find Flights", "Submit", "Search"]);
    if (!searchClicked) {
      await page.click('input[type="submit"]').catch(() => {});
    }
  }

  async searchShadcn(input) {
    this.logger.info("Starting Shadcn form-filling automation", {
      name: input.source,
      description: input.destination
    });

    const page = this.tools.page;

    this.logger.info("Waiting for Shadcn form preview card to load");
    // Wait for the form-rhf-demo or form-rhf-input, or input[name="title"]
    await page.waitForSelector("form#form-rhf-demo, form#form-rhf-input, input[name='title'], input[name='username']", { timeout: 15000 }).catch(() => {
      this.logger.warn("Form elements not loaded yet; waiting 2s as fallback.");
    });
    await page.waitForTimeout(2000);

    // Detect visible form fields
    const fields = await detectFormFields(page, this.logger);

    let nameField = null;
    let descField = null;

    if (this.gemini.enabled) {
      this.logger.info("Using Gemini to map form fields");
      const mapping = await this.gemini.chooseFieldMapping(fields);
      if (mapping) {
        nameField = fields.find((f) => f.agentId === mapping.nameFieldId);
        descField = fields.find((f) => f.agentId === mapping.descriptionFieldId);
      }
    }

    if (!nameField || !descField) {
      this.logger.info("Using heuristic fallback to map form fields");
      const mapping = chooseFieldsWithHeuristics(fields, this.logger);
      nameField = nameField || mapping.nameField;
      descField = descField || mapping.descriptionField;
    }

    if (!nameField) {
      throw new AgentError("Could not identify the Name/Username field on the page.");
    }
    if (!descField) {
      throw new AgentError("Could not identify the Description field on the page.");
    }

    // Fill Name field
    this.logger.info(`Filling Name/Username field with: "${input.source}"`);
    const nameLocator = page.locator(nameField.selector);
    await nameLocator.click();
    await nameLocator.fill(""); // clear first
    await nameLocator.type(input.source, { delay: 30 });

    // Fill Description field
    this.logger.info(`Filling Description field with: "${input.destination}"`);
    const descLocator = page.locator(descField.selector);
    await descLocator.click();
    await descLocator.fill(""); // clear first
    await descLocator.type(input.destination, { delay: 30 });

    // Click submit/Save button for the form
    this.logger.info("Locating and clicking Submit button");
    
    // Find button inside the form, or button with submit
    const submitBtn = page.locator("form#form-rhf-demo button[type='submit'], form#form-rhf-input button[type='submit'], button[type='submit']").first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      this.logger.info("Clicked form Submit/Save button.");
    } else {
      this.logger.warn("Submit button not found; attempting click by text.");
      await this.tryClickByRoleOrText(["Submit", "Save", "Reset"]);
    }

    await page.waitForTimeout(3000);
  }

  async tryHotelHomePageInteraction(input) {
    const destinationFilled = await this.tryFillField(
      [
        { type: "placeholder", value: "Where are you going?" },
        { type: "label", value: "Where are you going?" },
        { type: "selector", value: "input[name='ss']" },
        { type: "selector", value: "input[aria-label*='Destination' i]" }
      ],
      input.destination
    );

    const checkInFilled = await this.tryFillField(
      [
        { type: "label", value: "Check-in" },
        { type: "selector", value: "input[name='checkin']" }
      ],
      input.checkIn,
      { pressEnter: false }
    );

    const checkOutFilled = await this.tryFillField(
      [
        { type: "label", value: "Check-out" },
        { type: "selector", value: "input[name='checkout']" }
      ],
      input.checkOut,
      { pressEnter: false }
    );

    return destinationFilled && checkInFilled && checkOutFilled;
  }

  async tryFillField(candidates, value, options = {}) {
    const { pressEnter = true } = options;

    for (const candidate of candidates) {
      const locator = this.createLocator(candidate);
      const count = await locator.count().catch(() => 0);

      for (let index = 0; index < Math.min(count, 3); index += 1) {
        const item = locator.nth(index);
        const visible = await item.isVisible().catch(() => false);
        const enabled = await item.isEnabled().catch(() => false);

        if (!visible || !enabled) {
          continue;
        }

        await this.typeIntoLocator(item, value);

        if (pressEnter) {
          await this.tools.page.waitForTimeout(700);
          await this.tools.page.keyboard.press("Enter").catch(() => {});
        }

        this.logger.info("Filled field", {
          strategy: candidate.type,
          value: candidate.value,
          input: value
        });
        return true;
      }
    }

    this.logger.warn("Could not fill field with available candidates", {
      candidates: candidates.map((candidate) => candidate.value),
      input: value
    });
    return false;
  }

  createLocator(candidate) {
    const page = this.tools.page;

    if (candidate.type === "label") {
      return page.getByLabel(candidate.value, { exact: false });
    }

    if (candidate.type === "placeholder") {
      return page.getByPlaceholder(candidate.value, { exact: false });
    }

    if (candidate.type === "role") {
      return page.getByRole(candidate.role, { name: candidate.value, exact: false });
    }

    return page.locator(candidate.value);
  }

  async typeIntoLocator(locator, value) {
    await locator.scrollIntoViewIfNeeded({ timeout: 10000 }).catch(() => {});
    const box = await locator.boundingBox();

    if (!box) {
      throw new AgentError("Could not calculate element coordinates for typing.");
    }

    await this.tools.click_on_screen(Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2));
    await this.tools.page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await this.tools.send_keys(String(value));
  }

  async tryClickByRoleOrText(names) {
    for (const name of names) {
      const locators = [
        this.tools.page.getByRole("button", { name, exact: false }),
        this.tools.page.getByText(name, { exact: false })
      ];

      for (const locator of locators) {
        const count = await locator.count().catch(() => 0);
        for (let index = 0; index < Math.min(count, 3); index += 1) {
          const item = locator.nth(index);
          const visible = await item.isVisible().catch(() => false);
          if (!visible) {
            continue;
          }

          const box = await item.boundingBox();
          if (!box) {
            continue;
          }

          await this.tools.click_on_screen(Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2));
          this.logger.info("Clicked action", { name });
          return true;
        }
      }
    }

    return false;
  }

  async acceptPopups() {
    const popupButtons = [
      "Accept",
      "Accept all",
      "Accept cookies",
      "I agree",
      "Agree",
      "Got it"
    ];

    for (const text of popupButtons) {
      const clicked = await this.tryClickByRoleOrText([text]).catch(() => false);
      if (clicked) {
        this.logger.info("Accepted popup or cookie banner", { text });
        await this.tools.page.waitForTimeout(500);
        return;
      }
    }
  }

  async waitForResults(searchType) {
    const page = this.tools.page;
    const selectors =
      searchType === "hotels"
        ? ["[data-testid='property-card']", "[data-testid*='property']", "[class*='property-card']"]
        : searchType === "dummy"
        ? ["table.table"]
        : ["[data-testid*='itinerary']", "[data-testid*='flight']", "[class*='Flight']", "[class*='Result']"];

    this.logger.info("Waiting for result content", { searchType });

    for (const selector of selectors) {
      try {
        await page.locator(selector).first().waitFor({ state: "visible", timeout: 15000 });
        return;
      } catch {
        this.logger.warn("Result selector not visible yet", { selector });
      }
    }

    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  }

  async failIfAccessBlocked(searchType) {
    const url = this.tools.page.url().toLowerCase();
    const bodyText = await this.tools.page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
    const accessBlocked =
      url.includes("captcha") ||
      /robot|captcha|unusual traffic|verify you are human|access denied/i.test(bodyText);

    if (accessBlocked) {
      throw new AgentError(`${searchType} website blocked automated access with a CAPTCHA or bot check.`, {
        url: this.tools.page.url()
      });
    }
  }

  async collectMoreResults() {
    for (let index = 0; index < 4; index += 1) {
      await this.tools.scroll(850);
    }
  }
}

function normalizeSearchInput(input) {
  return {
    searchType: input.searchType,
    source: input.source?.trim(),
    destination: input.destination.trim(),
    departureDate: input.departureDate,
    returnDate: input.returnDate || "",
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    adults: Number(input.adults || 1),
    rooms: Number(input.rooms || 1)
  };
}

function buildSkyscannerSearchUrl(input) {
  const origin = toSkyscannerPlace(input.source);
  const destination = toSkyscannerPlace(input.destination);
  const departureDate = compactDate(input.departureDate);
  const returnDate = input.returnDate ? `/${compactDate(input.returnDate)}` : "";
  const adults = Number(input.adults || 1);

  return `https://www.skyscanner.co.in/transport/flights/${origin}/${destination}/${departureDate}${returnDate}/?adultsv2=${adults}&cabinclass=economy&currency=INR`;
}

function buildBookingSearchUrl(input) {
  const params = new URLSearchParams({
    ss: input.destination,
    checkin: input.checkIn,
    checkout: input.checkOut,
    group_adults: String(input.adults || 1),
    no_rooms: String(input.rooms || 1),
    group_children: "0"
  });

  return `https://www.booking.com/searchresults.html?${params.toString()}`;
}

function toSkyscannerPlace(value) {
  const cleaned = String(value || "").trim();
  if (/^[a-z]{3}$/i.test(cleaned)) {
    return cleaned.toLowerCase();
  }

  return cleaned
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function compactDate(value) {
  return String(value || "").replaceAll("-", "").slice(2);
}

function isSameBaseUrl(currentUrl, baseUrl) {
  try {
    const current = new URL(currentUrl);
    const base = new URL(baseUrl);
    return current.hostname === base.hostname && current.pathname.replace(/\/+$/, "") === base.pathname.replace(/\/+$/, "");
  } catch {
    return false;
  }
}
