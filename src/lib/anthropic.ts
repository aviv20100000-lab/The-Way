import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function analyzeFoodPhoto(imageUrl: string) {
  const response = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "url",
              url: imageUrl,
            },
          },
          {
            type: "text",
            text: `Analyze this food image and provide estimates in Hebrew. For each food item visible:
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
}]`,
          },
        ],
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  try {
    return JSON.parse(content.text);
  } catch {
    return { raw: content.text };
  }
}

export async function extractStepsFromScreenshot(imageUrl: string): Promise<number> {
  const response = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "url",
              url: imageUrl,
            },
          },
          {
            type: "text",
            text: `This is a screenshot from iPhone Health app or similar. Extract the number of steps shown.
Return ONLY a JSON object: {"steps": <number>}
If you cannot find a step count, return {"steps": 0}`,
          },
        ],
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  try {
    const result = JSON.parse(content.text);
    return result.steps || 0;
  } catch {
    return 0;
  }
}
