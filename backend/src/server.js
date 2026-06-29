import cors from "cors";
import express from "express";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { WebsiteAutomationAgent } from "./agent/automationAgent.js";
import { config } from "./config.js";
import { toErrorResponse } from "./utils/errors.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(
  cors({
    origin: config.frontendOrigin
  })
);
app.use(express.json());
app.use(morgan("dev"));
app.use("/screenshots", express.static(path.resolve(__dirname, "../screenshots")));

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format.")
  .refine(isValidDateString, "Date must be a real calendar date.")
  .refine(isTodayOrFutureDate, "Date cannot be in the past.");

const baseRunSchema = z.object({
  destination: z.string().trim().min(2),
  adults: z.coerce.number().int().min(1).max(9).optional(),
  rooms: z.coerce.number().int().min(1).max(8).optional(),
  headless: z.boolean().optional()
});

const runSchema = z.discriminatedUnion("searchType", [
  baseRunSchema.extend({
    searchType: z.literal("flights"),
    source: z.string().trim().min(2),
    departureDate: dateStringSchema,
    returnDate: dateStringSchema.optional()
  }),
  baseRunSchema.extend({
    searchType: z.literal("hotels"),
    checkIn: dateStringSchema,
    checkOut: dateStringSchema
  }),
  baseRunSchema.extend({
    searchType: z.literal("dummy"),
    source: z.string().trim().min(2)
  }),
  baseRunSchema.extend({
    searchType: z.literal("shadcn"),
    source: z.string().trim().min(2)
  })
]).superRefine((body, context) => {
  if (
    body.searchType === "flights" &&
    body.returnDate &&
    dateToTime(body.returnDate) < dateToTime(body.departureDate)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["returnDate"],
      message: "Return date cannot be before departure date."
    });
  }

  if (body.searchType === "hotels" && dateToTime(body.checkOut) <= dateToTime(body.checkIn)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["checkOut"],
      message: "Check-out date must be after check-in date."
    });
  }
});

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    geminiConfigured: Boolean(config.geminiApiKey),
    targets: {
      flights: config.skyscannerUrl,
      hotels: config.bookingUrl
    }
  });
});

app.post("/api/agent/run", async (request, response) => {
  try {
    const body = runSchema.parse(request.body || {});
    const agent = new WebsiteAutomationAgent({ headless: body.headless });
    const result = await agent.run(body);
    response.json(result);
  } catch (error) {
    response.status(error instanceof z.ZodError ? 400 : 500).json({
      success: false,
      error: toErrorResponse(error),
      ...(error.result || {})
    });
  }
});

app.use((error, _request, response, _next) => {
  response.status(400).json({
    success: false,
    error: toErrorResponse(error)
  });
});

app.listen(config.port, () => {
  console.log(`Automation backend running at http://localhost:${config.port}`);
});

function isValidDateString(value) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isTodayOrFutureDate(value) {
  const today = new Date();
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return dateToTime(value) >= todayDateOnly;
}

function dateToTime(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
}
