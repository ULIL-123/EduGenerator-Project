
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
  
  // Format user selections for the prompt
  const mathTopicsString = selectedTopics.math.length > 0 
    ? selectedTopics.math.join(", ") 
    : "General Mathematics (Basic Arithmetic, Logic)";
    
  const indTopicsString = selectedTopics.indonesian.length > 0 
    ? selectedTopics.indonesian.join(", ") 
    : "General Literacy (Reading Comprehension, Grammar)";

  const prompt = `
    Role: Senior International Academic Assessment Expert.
    Task: Create 30 high-quality TKA questions for Elementary (Grades 5-6).
    
    CRITICAL INSTRUCTION - STRICT TOPIC ADHERENCE:
    The user has actively selected specific topics. You MUST generate questions ONLY within these boundaries:
    
    1. NUMERACY SECTION (15 Questions):
       Target Topics: [${mathTopicsString}]
       - Generate 15 questions that are strictly categorized under these math topics.
       - Use realistic academic contexts appropriate for Grade 5-6 students.
    
    2. LITERACY SECTION (15 Questions):
       Target Topics: [${indTopicsString}]
       - Generate 15 questions that are strictly categorized under these literacy/language topics.
       - Each question MUST include a stimulus passage or short text.

    Difficulty Requirements:
    - Balanced distribution of Cognitive Levels: L1 (Pemahaman), L2 (Penerapan), and L3 (Penalaran/Higher-Order Thinking).

    Technical Specifications:
    - 'Pilihan Ganda': 'correctAnswer' must be a single character: "A", "B", "C", or "D".
    - 'Pilihan Ganda Kompleks (MCMA)': 'correctAnswer' must be a JSON array string: ["A", "C"]
    - 'Pilihan Ganda Kompleks (Kategori)': 'correctAnswer' must be a JSON object string: {"0": "Benar", "1": "Salah"}
    
    Output: Return ONLY valid JSON matching the provided schema.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", 
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: QUESTION_SCHEMA,
        temperature: 0.15, // High precision for topic adherence
        thinkingConfig: { thinkingBudget: 4096 }
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
            try { finalAnswer = JSON.parse(trimmed); } catch (e) { /* silent fallback */ }
          }
        }
        const subj = (q.subject || "").toLowerCase();
        const normalizedSubject = (subj.includes('mat') || subj.includes('num')) ? 'Matematika' : 'Bahasa Indonesia';
        return { ...q, correctAnswer: finalAnswer, subject: normalizedSubject };
    });
  } catch (error: any) {
    console.error("AI_TOPIC_ADHERENCE_ERROR:", error);
    throw new Error("Gagal menyusun materi soal sesuai pilihan. Pastikan koneksi internet stabil dan coba kembali.");
  }
}
