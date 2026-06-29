# Architecture Document

## Goal

The Smart Flight/Hotel Search Assistant automates real travel search workflows:

1. Open a browser.
2. Navigate to Skyscanner India for flights or Booking.com for hotels.
3. Accept common popups when visible.
4. Fill user-provided travel search details.
5. Trigger search.
6. Scroll dynamic result pages.
7. Extract visible travel options.
8. Ask Gemini to generate a recommendation summary.

## High-Level Design

The project is split into two independent folders:

- `frontend`: React dashboard for user input and result viewing.
- `backend`: Express API that owns Playwright automation, screenshots, result extraction, logs, and Gemini calls.

The Gemini API key is only read by the backend from `backend/.env`. It is never sent to the frontend.

## Automation Modules

File: `backend/src/agent/browserTools.js`

The required browser tools are implemented as reusable methods:

- `open_browser()`
- `navigate_to_url(url)`
- `take_screenshot(label)`
- `click_on_screen(x, y)`
- `send_keys(text)`
- `scroll(deltaY)`
- `double_click(x, y)`
- `extract_results(searchType)`

The main agent composes these tools instead of spreading raw Playwright calls everywhere.

## Main Agent Workflow

File: `backend/src/agent/automationAgent.js`

The `WebsiteAutomationAgent` controls the full workflow:

1. Launch browser in visible or headless mode.
2. Navigate to the target travel website.
3. Capture a page-loaded screenshot.
4. Detect and fill fields using labels, placeholders, selectors, and coordinate clicks.
5. Press Enter or click visible search actions.
6. Fall back to generated real-site search URLs if the live page interaction is incomplete.
7. Wait for result selectors or page network activity.
8. Scroll several times to load more result cards.
9. Extract result text, price, rating, and timing data.
10. Send extracted data to Gemini for summarized recommendations.
11. Return logs, screenshots, extracted results, and recommendation JSON.

## Flight Search

Target website:

```text
https://www.skyscanner.co.in/
```

User input:

- source city or airport code
- destination city or airport code
- departure date
- optional return date
- adults

The agent first attempts to interact with Skyscanner's visible inputs. If the site layout changes or fields cannot be completed, it falls back to a Skyscanner flight results URL built from the user input.

## Hotel Search

Target website:

```text
https://www.booking.com/
```

User input:

- destination
- check-in date
- check-out date
- adults
- rooms

The agent first attempts visible form interaction. If that is incomplete, it falls back to a Booking.com search URL with query parameters based on the user's input.

## Result Extraction

File: `backend/src/agent/browserTools.js`

`extract_results(searchType)` searches for common result-card selectors:

- flight result cards and itinerary blocks
- hotel property cards

For each result, it extracts:

- title or leading description
- price
- numeric price value
- rating when visible
- flight time range when visible
- raw text sample

If no structured cards are found, the agent falls back to visible page text blocks containing price-like patterns.

## Gemini Recommendation

File: `backend/src/services/geminiService.js`

Gemini receives the user search input and extracted result list. It returns compact JSON:

- cheapest option
- best-rated option
- recommended option
- short summary

If Gemini is not configured or fails, the backend returns a local fallback summary.

## Error Handling

The agent handles:

- validation errors from incomplete frontend input
- network timeouts
- missing element detection
- changing website selectors
- popup/cookie banners
- incomplete result extraction
- Gemini failures

When possible, it captures an error-state screenshot before returning failure details.

## Frontend Workflow

File: `frontend/src/main.jsx`

The frontend:

1. Checks backend health.
2. Lets the user choose Flights or Hotels.
3. Collects travel input from the user.
4. Calls `POST /api/agent/run`.
5. Displays Gemini recommendations, extracted results, screenshots, and logs.

## Design Decisions

- Playwright is used for robust browser automation.
- Real websites are used as requested: Skyscanner India and Booking.com.
- User input is collected dynamically; source and destination are not hardcoded.
- Coordinate-based clicking is used after intelligent element detection.
- URL fallback improves live-demo reliability when travel sites change markup.
- Gemini is backend-only to keep API keys safe.
