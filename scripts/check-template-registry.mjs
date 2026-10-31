import assert from "node:assert/strict";
import { EVENT_TEMPLATES, getTemplate, isKnownEventTemplate } from "../src/templates/eventTemplateRegistry.js";

const expectedKeys = [
  "esports-001",
  "garba-001",
  "sports-001",
  "workshop-001",
  "coaching-001",
  "cultural-001",
  "community-001"
];

assert.deepEqual(EVENT_TEMPLATES.map((template) => template.key), expectedKeys);
assert.equal(new Set(EVENT_TEMPLATES.map((template) => template.key)).size, expectedKeys.length, "Template keys must be unique.");

for (const template of EVENT_TEMPLATES) {
  assert.ok(template.name && template.label && template.category, template.key + " must have category metadata.");
  assert.ok(template.title && template.sampleDescription && template.sampleRules, template.key + " must have usable starter content.");
  assert.equal(template.themeId, "event-baseline", template.key + " must use the event theme scope.");
  assert.equal(typeof template.icon, "object", template.key + " must retain its Lucide component.");
  assert.equal(isKnownEventTemplate(template.key), true);
  assert.equal(Object.isFrozen(template), true, template.key + " registry metadata must be immutable.");
}

assert.equal(getTemplate("esports-001").key, "esports-001");
assert.equal(getTemplate("not-a-template").key, "esports-001", "Unknown keys must retain the existing safe fallback.");
assert.equal(isKnownEventTemplate("not-a-template"), false);

console.log("Event template registry checks passed.");
