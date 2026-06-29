import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 5001),
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-1.5-flash",
  headless: String(process.env.HEADLESS || "false").toLowerCase() === "true",
  skyscannerUrl: process.env.SKYSCANNER_URL || "https://www.skyscanner.co.in/",
  bookingUrl: process.env.BOOKING_URL || "https://www.booking.com/"
};
