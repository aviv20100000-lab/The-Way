import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const MAX_ANTHROPIC_IMAGE_BYTES = 7.5 * 1024 * 1024; // 7.5MB

const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
export type AnthropicImageMediaType = (typeof SUPPORTED_IMAGE_TYPES)[number];

export function isAnthropicImageMediaType(type: string): type is AnthropicImageMediaType {
  return (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(type);
}

const FOOD_PROMPT_JSON = `You are a nutrition expert. Look carefully at this photo and list ONLY the food items you can clearly see.

STRICT RULES:
- Do NOT invent or assume foods that are not clearly visible.
- If unsure whether something is present, omit it.
- Name each item in Hebrew based on what you actually see (color, texture, shape):
  • Yellow/white set or fluffy egg dish → חביתה or ביצה מקושקשת (NOT chicken)
  • White lumpy dairy with visible curds → קוטג'
  • Smooth white cream → שמנת חמוצה or יוגורט
  • Smooth white spread → גבינה לבנה
- Estimate weight from plate/utensil size.
- Add one entry for cooking oil or dressing ONLY if you can see oil sheen or sauce.

Return ONLY a raw JSON array (no markdown):
[{"name_he":"שם בעברית","estimated_weight_g":150,"calories":300,"protein":20,"carbs":30,"fat":10}]

Round all numbers. Never return zeros.`;

const FOOD_PROMPT_TOOL = `You are a nutrition expert analyzing a food photo. Think step-by-step:

STEP 1 — SCAN: Describe each distinct visual region you see (color, texture, shape, estimated size).
STEP 2 — IDENTIFY: For each region, name the food based ONLY on what you see. If uncertain, omit it.
STEP 3 — ESTIMATE: Use visual cues for portion weight. State your reasoning briefly.
STEP 4 — CONFIDENCE: Rate each item 0.0–1.0. Only include items you are at least 0.6 confident about.

STRICT RULES:
- RULE #1 — PACKAGED FOOD: If you see a product box, bag, or container with a label — READ the label to identify the food type and fat percentage. Use ONLY the generic food name + fat % (e.g. "קוטג' 5%", "שמנת חמוצה 15%", "יוגורט 3%"). NEVER include brand names.
- RULE #2 — PLATED FOOD (no packaging visible): Identify by what you actually see on the plate/bowl. Do NOT invent a brand or product name.
  • Yellow/white fluffy or set egg → חביתה or ביצה מקושקשת (NEVER עוף)
  • White dairy with visible curds → קוטג'
  • Smooth white cream in a bowl → שמנת חמוצה or יוגורט
  • Smooth white spread on bread → גבינה לבנה
- Do NOT invent foods. Only include what you clearly see.
- Add oil/dressing ONLY if you see visible oil sheen or pooling sauce.`;

function extractJson(text: string): string {
  // Strip markdown code fences if present
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  // Grab the outermost JSON array or object
  const firstArr = t.indexOf("[");
  const firstObj = t.indexOf("{");
  let start = -1;
  if (firstArr === -1) start = firstObj;
  else if (firstObj === -1) start = firstArr;
  else start = Math.min(firstArr, firstObj);
  if (start === -1) return t;
  const open = t[start];
  const close = open === "[" ? "]" : "}";
  const end = t.lastIndexOf(close);
  if (end > start) return t.slice(start, end + 1);
  return t;
}

function parseFoodResponse(text: string) {
  try {
    return JSON.parse(extractJson(text));
  } catch {
    return { raw: text };
  }
}

export async function analyzeFoodPhoto(imageUrl: string) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: imageUrl } },
          { type: "text", text: FOOD_PROMPT_JSON },
        ],
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");
  return parseFoodResponse(content.text);
}

const LOG_FOOD_TOOL = {
  name: "log_food_items",
  description: "Log the food items identified in the image with their nutritional estimates.",
  input_schema: {
    type: "object" as const,
    properties: {
      items: {
        type: "array",
        description: "List of food items clearly visible in the image. Only include items you can see.",
        items: {
          type: "object",
          properties: {
            name_he:             { type: "string",  description: "Food name in Hebrew" },
            estimated_weight_g:  { type: "integer", description: "Estimated weight in grams for the portion shown" },
            calories:            { type: "integer", description: "Total calories for this portion" },
            protein:             { type: "number",  description: "Protein in grams" },
            carbs:               { type: "number",  description: "Carbohydrates in grams" },
            fat:                 { type: "number",  description: "Fat in grams" },
            confidence:          { type: "number",  description: "0.0–1.0 certainty this item is correctly identified. Only include items above 0.6." },
            reasoning:           { type: "string",  description: "One sentence: visual evidence that led to this identification and portion estimate." },
          },
          required: ["name_he", "estimated_weight_g", "calories", "protein", "carbs", "fat", "confidence"],
        },
      },
    },
    required: ["items"],
  },
};

export async function analyzeFoodPhotoBase64(base64: string, mediaType: string) {
  const validType = (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mediaType)
    ? mediaType
    : "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    tools: [LOG_FOOD_TOOL],
    tool_choice: { type: "any" },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: validType, data: base64 } },
          { type: "text", text: FOOD_PROMPT_TOOL },
        ],
      },
    ],
  });

  // Extract structured data from tool call — guaranteed shape, no parsing needed
  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (toolUse && toolUse.type === "tool_use") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (toolUse.input as any).items ?? [];
  }

  // Fallback: parse text if tool use somehow didn't fire
  const textBlock = response.content.find((b) => b.type === "text");
  if (textBlock && textBlock.type === "text") return parseFoodResponse(textBlock.text);
  throw new Error("No response from model");
}

export async function estimateNutritionByName(name: string, grams: number) {
  const prompt = `A user is logging a food item by name. Estimate its nutrition for the given portion.
Food name (may be in Hebrew): "${name}"
Portion weight: ${grams} grams

Return ONLY a raw JSON object (no markdown, no explanation) with realistic estimates for that exact weight:
{"calories": <number>, "protein": <number>, "carbs": <number>, "fat": <number>}
All values are for the full ${grams}g portion. Round to whole numbers. Never return zeros for a real food — give your best estimate.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    temperature: 0,
    messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const parsed = parseFoodResponse(content.text) as {
    calories?: number; protein?: number; carbs?: number; fat?: number; raw?: string;
  };

  return {
    calories: Math.max(0, Math.round(Number(parsed.calories) || 0)),
    protein_g: Math.max(0, Math.round(Number(parsed.protein) || 0)),
    carbs_g: Math.max(0, Math.round(Number(parsed.carbs) || 0)),
    fat_g: Math.max(0, Math.round(Number(parsed.fat) || 0)),
  };
}

const STEPS_PROMPT = `This is a screenshot from iPhone Health app or similar. Extract the number of steps shown.
Return ONLY a JSON object: {"steps": <number>}
If you cannot find a step count, return {"steps": 0}`;

function parseStepsResponse(text: string): number {
  try {
    return JSON.parse(extractJson(text)).steps || 0;
  } catch {
    return 0;
  }
}

export async function extractStepsFromScreenshot(imageUrl: string): Promise<number> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "url", url: imageUrl } },
        { type: "text", text: STEPS_PROMPT },
      ],
    }],
  });
  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");
  return parseStepsResponse(content.text);
}

export async function extractStepsFromScreenshotBase64(base64: string, mediaType: string): Promise<number> {
  const validType = (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mediaType)
    ? mediaType
    : "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: validType, data: base64 } },
        { type: "text", text: STEPS_PROMPT },
      ],
    }],
  });
  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");
  return parseStepsResponse(content.text);
}
