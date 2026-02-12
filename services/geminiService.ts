
import { GoogleGenAI, Type } from "@google/genai";
import { Question, TopicSelection } from "../types";

/**
 * Utility for cleaning AI JSON response from Markdown formatting or stray characters.
 */
function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
  
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  
  if (firstBracket !== -1 && lastBracket !== -1) {
    cleaned = cleaned.substring(firstBracket, lastBracket + 1);
  }
  
  return cleaned;
}

const QUESTION_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      subject: { type: Type.STRING, description: "Must be 'Matematika' or 'Bahasa Indonesia'" },
      topic: { type: Type.STRING },
      type: { type: Type.STRING, description: "Pilihan Ganda, Pilihan Ganda Kompleks (MCMA), or Pilihan Ganda Kompleks (Kategori)" },
      cognitiveLevel: { type: Type.STRING, description: "L1 (Pemahaman), L2 (Penerapan), or L3 (Penalaran)" },
      text: { type: Type.STRING },
      passage: { type: Type.STRING, description: "Required for Literacy and Math word problems" },
      options: { type: Type.ARRAY, items: { type: Type.STRING } },
      correctAnswer: { type: Type.STRING, description: "A for PG, JSON array for MCMA, or JSON object for Category" },
      categories: { 
        type: Type.ARRAY, 
        items: { 
          type: Type.OBJECT, 
          properties: {
            statement: { type: Type.STRING },
            category: { type: Type.STRING, description: "Benar or Salah" }
          } 
        }
      },
      explanation: { type: Type.STRING, description: "Deep reasoning behind the correct answer" }
    },
    required: ["id", "subject", "topic", "type", "text", "correctAnswer", "cognitiveLevel", "explanation"]
  }
};

export async function generateTKAQuestions(selectedTopics: TopicSelection): Promise<Question[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const mathTopics = selectedTopics.math.length > 0 ? selectedTopics.math.join(", ") : "Bilangan, Aljabar, Geometri";
  const indTopics = selectedTopics.indonesian.length > 0 ? selectedTopics.indonesian.join(", ") : "Literasi Teks Informasi & Sastra";

  const prompt = `
    Role: International Academic Assessment Expert.
    Task: Create 30 high-quality TKA questions for Elementary (Grades 5-6).
    
    Distribution:
    - 15 Numeracy (Math) questions regarding: ${mathTopics}
    - 15 Literacy (Indonesian) questions regarding: ${indTopics}

    Answer Format Rules:
    1. 'Pilihan Ganda': 'correctAnswer' must be "A", "B", "C", or "D".
    2. 'Pilihan Ganda Kompleks (MCMA)': 'correctAnswer' must be a valid JSON array string like ["A", "C"]
    3. 'Pilihan Ganda Kompleks (Kategori)': 'correctAnswer' must be a valid JSON object string like {"0": "Benar", "1": "Salah"}
    
    Validation Requirements:
    - Use varied cognitive levels (L1-L3).
    - Literacy questions MUST have a 'passage'.
    - Numeracy questions MUST use real-world logic.
    - Explanations MUST be logical and helpful.
  `;

  try {
    /* Fix: Upgrade to 'gemini-3-pro-preview' for complex academic tasks and enable thinking budget */
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", 
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: QUESTION_SCHEMA,
        temperature: 0.2, // Lower temperature for more consistent academic validity
        thinkingConfig: { thinkingBudget: 4096 } // Allow reasoning for complex question synthesis
      }
    });

    const rawText = response.text;
    if (!rawText) throw new Error("Null AI response");
    
    const cleanedJson = cleanJsonResponse(rawText);
    const results = JSON.parse(cleanedJson);
    
    return results.map((q: any) => {
        let finalAnswer = q.correctAnswer;
        if (typeof q.correctAnswer === 'string') {
          const trimmed = q.correctAnswer.trim();
          if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
            try { finalAnswer = JSON.parse(trimmed); } catch (e) { /* fallback */ }
          }
        }
        const subj = (q.subject || "").toLowerCase();
        const normalizedSubject = (subj.includes('mat') || subj.includes('num')) ? 'Matematika' : 'Bahasa Indonesia';
        return { ...q, correctAnswer: finalAnswer, subject: normalizedSubject };
    });
  } catch (error: any) {
    console.error("AI_GEN_ERROR:", error);
    throw new Error("High traffic detected. Please re-initialize generation in a few seconds.");
  }
}
