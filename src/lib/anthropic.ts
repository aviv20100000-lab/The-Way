import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const FOOD_PROMPT = `Analyze this food image and provide estimates in Hebrew. For each food item visible:
1. Name (in Hebrew)
2. Estimated weight/quantity
3. Estimated calories
4. Protein (grams)
5. Carbs (grams)
6. Fat (grams)

Also provide 3 portion size options (small, medium, large) with calorie estimates for each.

Return as JSON array with structure:
[{
  "name_he": "שם המזון",
  "estimated_weight_g": 100,
  "calories": 150,
  "protein": 5,
  "carbs": 20,
  "fat": 3,
  "portions": [
    {"size": "קטן", "weight_g": 50, "calories": 75},
    {"size": "בינוני", "weight_g": 100, "calories": 150},
    {"size": "גדול", "weight_g": 150, "calories": 225}
  ]
}]

IMPORTANT: Return ONLY the raw JSON array. No markdown code fences, no explanations, no extra text. If you cannot identify any food, return a best-effort estimate — never return empty or zero values.`;

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
          { type: "text", text: FOOD_PROMPT },
        ],
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");
  return parseFoodResponse(content.text);
}

export async function analyzeFoodPhotoBase64(base64: string, mediaType: string) {
  const validType = (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mediaType)
    ? mediaType
    : "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: validType, data: base64 } },
          { type: "text", text: FOOD_PROMPT },
        ],
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");
  return parseFoodResponse(content.text);
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
