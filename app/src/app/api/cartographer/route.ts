import { NextRequest, NextResponse } from "next/server";
import { AzureOpenAI } from "openai";

const client = new AzureOpenAI({
  endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
  apiVersion: "2025-04-01-preview",
});

const SYSTEM_PROMPT = `You are "Cartographer", an AI assistant for InternAtlas - a job search platform for internships and new grad positions.

Your job is to help users find the best search terms for discovering relevant job listings. When a user describes what they're looking for, you suggest:

1. **Title Keywords**: Job title terms to search for (e.g., "Software Engineer", "Data Analyst", "Product Manager Intern")
2. **Location Keywords**: Location terms if relevant (e.g., "San Francisco", "Remote", "New York")

Guidelines:
- Suggest 2-5 title keywords that would match relevant job postings
- Consider variations (e.g., "SWE" vs "Software Engineer", "ML" vs "Machine Learning")
- Think about common job title patterns at tech companies
- For internships, include both "[Role] Intern" and "Intern, [Role]" variations
- For new grad roles, consider "New Grad", "Entry Level", "Associate" variations
- Be specific but also consider broader terms that might catch more listings

Respond in JSON format:
{
  "titleKeywords": ["keyword1", "keyword2", ...],
  "locationKeywords": ["location1", "location2", ...],
  "explanation": "Brief explanation of why these terms were chosen"
}`;

export async function POST(request: NextRequest) {
  console.log("Cartographer request received");
  console.log("AZURE_OPENAI_ENDPOINT:", process.env.AZURE_OPENAI_ENDPOINT);
  console.log("AZURE_OPENAI_DEPLOYMENT:", process.env.AZURE_OPENAI_DEPLOYMENT);
  console.log("API Key exists:", !!process.env.AZURE_OPENAI_API_KEY);
  
  try {
    const { query } = await request.json();
    console.log("Query:", query);

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    console.log("Calling Azure OpenAI...");
    let response;
    try {
      response = await client.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-5-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: query },
        ],
        max_completion_tokens: 2000,
      });
      console.log("Azure OpenAI response received:", JSON.stringify(response, null, 2));
    } catch (apiError: unknown) {
      const e = apiError as { message?: string; status?: number; code?: string; error?: unknown };
      console.error("Azure OpenAI API call failed:", JSON.stringify({
        message: e.message,
        status: e.status,
        code: e.code,
        error: e.error,
      }, null, 2));
      throw apiError;
    }

    const content = response.choices[0]?.message?.content;
    console.log("Response content:", content);

    if (!content) {
      console.error("No content in response");
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 }
      );
    }

    // Parse the JSON response
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      console.log("JSON match:", jsonMatch?.[0]);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      const parsed = JSON.parse(jsonMatch[0]);
      console.log("Parsed response:", parsed);
      
      return NextResponse.json({
        titleKeywords: parsed.titleKeywords || [],
        locationKeywords: parsed.locationKeywords || [],
        explanation: parsed.explanation || "",
      });
    } catch (parseError) {
      console.error("Failed to parse AI response:", content, parseError);
      return NextResponse.json(
        { error: "Failed to parse AI response", raw: content },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number; code?: string };
    console.error("Cartographer API error:", {
      message: err.message,
      status: err.status,
      code: err.code,
      full: error,
    });
    return NextResponse.json(
      { error: err.message || "Failed to get suggestions" },
      { status: 500 }
    );
  }
}
