export async function detectFormFields(page, logger) {
  logger.info("Detecting visible form controls");

  const fields = await page.locator("input, textarea, [contenteditable='true']").evaluateAll((nodes) =>
    nodes
      .map((node, index) => {
        const agentId = `field-${index}`;
        node.setAttribute("data-agent-field-id", agentId);

        const id = node.getAttribute("id") || "";
        const name = node.getAttribute("name") || "";
        const placeholder = node.getAttribute("placeholder") || "";
        const ariaLabel = node.getAttribute("aria-label") || "";
        const tagName = node.tagName.toLowerCase();
        const type = node.getAttribute("type") || tagName;
        const label =
          id && document.querySelector(`label[for="${CSS.escape(id)}"]`)
            ? document.querySelector(`label[for="${CSS.escape(id)}"]`).textContent.trim()
            : node.closest("label")?.textContent.trim() || "";
        const rect = node.getBoundingClientRect();

        return {
          agentId,
          selector: `[data-agent-field-id="${agentId}"]`,
          id,
          name,
          placeholder,
          ariaLabel,
          label,
          tagName,
          type,
          visible:
            rect.width > 0 &&
            rect.height > 0 &&
            window.getComputedStyle(node).visibility !== "hidden" &&
            window.getComputedStyle(node).display !== "none",
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2)
        };
      })
      .filter((field) => field.visible)
  );

  logger.info("Detected form controls", { count: fields.length, fields });
  return fields;
}

export function chooseFieldsWithHeuristics(fields, logger) {
  const scoreField = (field, keywords) => {
    const haystack = [
      field.id,
      field.name,
      field.placeholder,
      field.ariaLabel,
      field.label,
      field.tagName
    ]
      .join(" ")
      .toLowerCase();

    return keywords.reduce((score, keyword) => score + (haystack.includes(keyword) ? 1 : 0), 0);
  };

  const nameField = fields
    .map((field) => ({ field, score: scoreField(field, ["name", "username", "title"]) }))
    .sort((a, b) => b.score - a.score)[0]?.field;

  const descriptionField =
    fields
      .map((field) => ({
        field,
        score: scoreField(field, ["description", "bio", "message", "about"])
      }))
      .sort((a, b) => b.score - a.score)[0]?.field ||
    fields.find((field) => field.tagName === "textarea");

  logger.info("Heuristic field choice complete", {
    nameField,
    descriptionField
  });

  return { nameField, descriptionField };
}
