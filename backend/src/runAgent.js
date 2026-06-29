import { WebsiteAutomationAgent } from "./agent/automationAgent.js";

const agent = new WebsiteAutomationAgent();

agent
  .run({
    searchType: "hotels",
    destination: "Goa",
    checkIn: "2026-07-10",
    checkOut: "2026-07-12",
    adults: 2,
    rooms: 1
  })
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(JSON.stringify(error.result || { message: error.message }, null, 2));
    process.exit(1);
  });
