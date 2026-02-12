
import { GoogleGenAI, Type } from "@google/genai";
import { Question, TopicSelection } from "../types";

const QUESTION_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      subject: { type: Type.STRING },
      topic: { type: Type.STRING },
      type: { type: Type.STRING },
      cognitiveLevel: { type: Type.STRING, description: "L1 (Pemahaman), L2 (Penerapan), or L3 (Penalaran)" },
      text: { type: Type.STRING },
      passage: { type: Type.STRING },
      options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Required for Pilihan Ganda and MCMA" },
      correctAnswer: { type: Type.STRING, description: "String key (e.g., 'A'), or JSON Array (e.g., '[\"A\", \"B\"]'), or JSON Object (e.g., '{\"0\": \"Benar\", \"1\": \"Salah\"}')" },
      categories: { 
        type: Type.ARRAY, 
        items: { 
          type: Type.OBJECT, 
          properties: {
            statement: { type: Type.STRING },
            category: { type: Type.STRING }
          } 
        },
        description: "Only for Pilihan Ganda Kompleks (Kategori)"
      },
      explanation: { type: Type.STRING }
    },
    required: ["id", "subject", "topic", "type", "text", "correctAnswer", "cognitiveLevel"]
  }
};

export async function generateTKAQuestions(selectedTopics: TopicSelection): Promise<Question[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Identity: Senior Assessment Designer for ANBK Indonesia (Kemendikdasmen).
    Task: Generate exactly 20 premium TKA SD (Academic Ability Test) questions.
    Distribution: 10 Numeracy (Math) and 10 Literacy (Bahasa Indonesia).
    
    Topics to utilize:
    - Numeracy: ${selectedTopics.math.join(", ")}
    - Literacy: ${selectedTopics.indonesian.join(", ")}

    Rigid Formatting Requirements:
    1. Language: Formal, high-level Indonesian (Baku).
    2. Question Mix: Balance between 'Pilihan Ganda', 'Pilihan Ganda Kompleks (MCMA)', and 'Pilihan Ganda Kompleks (Kategori)'.
    3. Correct Answer Format (STRICT):
       - 'Pilihan Ganda': Plain string matching one of the options (e.g., "A").
       - 'MCMA': JSON stringified array of strings (e.g., "[\"A\", \"C\"]").
       - 'Kategori': JSON stringified object mapping index to "Benar" or "Salah" (e.g., "{\"0\": \"Benar\", \"1\": \"Salah\"}").
    4. Data Integrity: Ensure 'passage' is present for literacy and complex numeracy word problems. Ensure 'options' are present for MC and MCMA types.
    5. Cognitive Standard: Map each question to L1, L2, or L3 correctly.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 }, // Instant response mode
        responseMimeType: "application/json",
        responseSchema: QUESTION_SCHEMA,
        temperature: 0.4 // High consistency for academic testing
      }
    });

    if (!response.text) throw new Error("AI Terminal returned an empty payload.");
    
    const results = JSON.parse(response.text);
    
    return results.map((q: any) => {
        let finalAnswer = q.correctAnswer;
        
        // Advanced JSON parsing for deep structures
        if (typeof q.correctAnswer === 'string') {
          const trimmed = q.correctAnswer.trim();
          if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
            try {
              finalAnswer = JSON.parse(trimmed);
            } catch (e) {
              console.warn("Soft parse bypass on answer:", trimmed);
            }
          }
        }

        // Subject Normalization
        const subjTag = q.subject.toLowerCase();
        const subject = (subjTag.includes('mat') || subjTag.includes('num')) ? 'Matematika' : 'Bahasa Indonesia';

        return { 
          ...q, 
          correctAnswer: finalAnswer,
          subject
        };
    });
  } catch (error) {
    console.error("Critical System Interruption:", error);
    throw error;
  }
}
