
import { GoogleGenAI, Type } from "@google/genai";
import { Question, TopicSelection } from "../types";

/**
 * Utility to clean AI output strings from potential Markdown JSON blocks.
 * Vital for production environments where models might ignore responseMimeType slightly.
 */
function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }
  return cleaned.trim();
}

const QUESTION_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      subject: { type: Type.STRING, description: "Must be 'Matematika' or 'Bahasa Indonesia'" },
      topic: { type: Type.STRING },
      type: { type: Type.STRING, description: "Must be 'Pilihan Ganda', 'Pilihan Ganda Kompleks (MCMA)', or 'Pilihan Ganda Kompleks (Kategori)'" },
      cognitiveLevel: { type: Type.STRING, description: "L1 (Pemahaman), L2 (Penerapan), or L3 (Penalaran)" },
      text: { type: Type.STRING, description: "The main question text" },
      passage: { type: Type.STRING, description: "Required for literacy or complex math context" },
      options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Required for Pilihan Ganda and MCMA. Exactly 4 or 5 options." },
      correctAnswer: { type: Type.STRING, description: "Crucial: 'A' for MC, '[\"A\", \"C\"]' for MCMA, or '{\"0\": \"Benar\", \"1\": \"Salah\"}' for Category" },
      categories: { 
        type: Type.ARRAY, 
        items: { 
          type: Type.OBJECT, 
          properties: {
            statement: { type: Type.STRING },
            category: { type: Type.STRING, description: "Must be 'Benar' or 'Salah'" }
          } 
        },
        description: "Only for 'Pilihan Ganda Kompleks (Kategori)'"
      },
      explanation: { type: Type.STRING, description: "Detailed pedagogical explanation" }
    },
    required: ["id", "subject", "topic", "type", "text", "correctAnswer", "cognitiveLevel"]
  }
};

export async function generateTKAQuestions(selectedTopics: TopicSelection): Promise<Question[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Robust topic handling
  const mathTopics = selectedTopics.math.length > 0 ? selectedTopics.math.join(", ") : "Semua topik dasar";
  const indTopics = selectedTopics.indonesian.length > 0 ? selectedTopics.indonesian.join(", ") : "Semua topik dasar";

  const prompt = `
    Identity: Professional Assessment Developer for ANBK (Asesmen Nasional Berbasis Komputer).
    Task: Generate 20 high-quality TKA SD (Academic Ability Test) questions.
    
    Distribution: 
    - 10 Numeracy (Matematika) based on: ${mathTopics}
    - 10 Literacy (Bahasa Indonesia) based on: ${indTopics}

    Rigid Quality Standards:
    1. Language: Formal Indonesian (Bahasa Indonesia Baku).
    2. Variety: Use a mix of 'Pilihan Ganda', 'Pilihan Ganda Kompleks (MCMA)', and 'Pilihan Ganda Kompleks (Kategori)'.
    3. Correct Answer Format (STRICT REQUIREMENT):
       - If type is 'Pilihan Ganda', use a single letter: "A" or "B" or "C" etc.
       - If type is 'Pilihan Ganda Kompleks (MCMA)', use a JSON array string: ["A", "C"]
       - If type is 'Pilihan Ganda Kompleks (Kategori)', use a JSON object string: {"0": "Benar", "1": "Salah"}
    4. Stimulus: Literacy questions MUST have a 'passage'. Numeracy word problems SHOULD have a 'passage'.
    5. Cognitive: Map levels correctly (L1: Recall, L2: Application, L3: Analysis).
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: QUESTION_SCHEMA,
        temperature: 0.3, // Lowered for maximum consistency in production
      }
    });

    const rawText = response.text;
    if (!rawText) throw new Error("AI engine returned null response.");
    
    const cleanedJson = cleanJsonResponse(rawText);
    const results = JSON.parse(cleanedJson);
    
    if (!Array.isArray(results)) throw new Error("Response is not a valid question array.");

    return results.map((q: any) => {
        let finalAnswer = q.correctAnswer;
        
        // Handle potential stringified JSON in correctAnswer field
        if (typeof q.correctAnswer === 'string') {
          const trimmed = q.correctAnswer.trim();
          if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
            try {
              finalAnswer = JSON.parse(trimmed);
            } catch (e) {
              console.warn("Soft parse failed on answer for ID:", q.id, "using raw string.");
            }
          }
        }

        // Normalize Subject
        const subjTag = (q.subject || "").toLowerCase();
        const subject = (subjTag.includes('mat') || subjTag.includes('num')) ? 'Matematika' : 'Bahasa Indonesia';

        return { 
          ...q, 
          correctAnswer: finalAnswer,
          subject
        };
    });
  } catch (error: any) {
    console.error("GENERATE_TKA_CRITICAL_FAILURE:", error);
    // Rethrow with user-friendly context if needed
    throw new Error(error.message || "Gagal menghubungkan ke AI. Silakan periksa koneksi Anda.");
  }
}
