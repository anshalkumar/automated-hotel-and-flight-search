export class AgentError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "AgentError";
    this.details = details;
  }
}

export function toErrorResponse(error) {
  if (error?.name === "ZodError" && Array.isArray(error.issues)) {
    return {
      message: "Invalid request payload",
      details: {
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      }
    };
  }

  return {
    message: error.message || "Unexpected automation error",
    details: error.details || {},
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack
  };
}
