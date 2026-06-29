export class AgentLogger {
  constructor() {
    this.entries = [];
  }

  info(message, data = {}) {
    this.add("info", message, data);
  }

  warn(message, data = {}) {
    this.add("warn", message, data);
  }

  error(message, data = {}) {
    this.add("error", message, data);
  }

  add(level, message, data = {}) {
    const entry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString()
    };

    this.entries.push(entry);
    const printableData = Object.keys(data).length ? ` ${JSON.stringify(data)}` : "";
    console.log(`[${entry.timestamp}] [${level.toUpperCase()}] ${message}${printableData}`);
  }

  list() {
    return this.entries;
  }
}
