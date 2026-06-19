import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function analyzeFoodPhoto(base64Image: string, mimeType: string) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/webp", data: base64Image },
          },
          {
            type: "text",
            text: `אתה מומחה תזונה. נתח את התמונה הזו של אוכל.

החזר JSON בפורמט הבא בלבד (ללא טקסט נוסף):
{
  "items": [
    {
      "name": "שם המאכל בעברית",
      "estimated_weight_g": 150,
      "calories": 300,
      "protein_g": 20,
      "carbs_g": 30,
      "fat_g": 10
    }
  ],
  "total_calories": 300,
  "notes": "הערה קצרה על הארוחה"
}

אם אינך בטוח במשקל המדויק, תן הערכה סבירה לפי גודל המנה הנראה בתמונה.`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("לא ניתן לנתח את התמונה");
  return JSON.parse(jsonMatch[0]);
}

export async function analyzeStepsScreenshot(base64Image: string, mimeType: string): Promise<number> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType as "image/jpeg" | "image/png" | "image/webp", data: base64Image },
          },
          {
            type: "text",
            text: `זו תמונה מאפליקציית הבריאות של אייפון או כל אפליקציית ספירת צעדים.
חפש את מספר הצעדים היומי.
החזר מספר שלם בלבד (ללא טקסט נוסף), לדוגמה: 8432`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text.trim() : "0";
  const steps = parseInt(text.replace(/[^0-9]/g, ""), 10);
  return isNaN(steps) ? 0 : steps;
}
