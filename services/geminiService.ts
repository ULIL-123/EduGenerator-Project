
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
      cognitiveLevel: { type: Type.STRING, description: "L1 (Pemahaman), L2 (Penerapan), atau L3 (Penalaran)" },
      text: { type: Type.STRING },
      passage: { type: Type.STRING, description: "Teks stimulus/bacaan untuk Literasi atau konteks Numerasi" },
      options: { type: Type.ARRAY, items: { type: Type.STRING } },
      correctAnswer: { type: Type.STRING, description: "Kunci jawaban. Jika pilihan ganda kompleks, gunakan format string array JSON [\"A\", \"B\"]. Jika kategori, gunakan format string object JSON {\"0\": \"Benar\", \"1\": \"Salah\"}." },
      categories: { 
        type: Type.ARRAY, 
        items: {
          type: Type.OBJECT,
          properties: {
            statement: { type: Type.STRING },
            category: { type: Type.STRING }
          }
        }
      },
      explanation: { type: Type.STRING, description: "Penjelasan ilmiah berdasarkan konsep kurikulum merdeka" }
    },
    required: ["id", "subject", "topic", "type", "text", "correctAnswer", "cognitiveLevel"]
  }
};

export async function generateTKAQuestions(selectedTopics: TopicSelection): Promise<Question[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const mathTopicsStr = selectedTopics.math.join(", ");
  const indonesianTopicsStr = selectedTopics.indonesian.join(", ");

  const prompt = `
    Anda adalah Pakar Asesmen Nasional Kemendikdasmen RI.
    Susunlah 30 butir soal Tes Kemampuan Akademik (TKA) SD standar ANBK secara cepat.

    KISI-KISI:
    1. LITERASI (15 Soal): Fokus pada interpretasi teks fiksi/informasi. Topik: ${indonesianTopicsStr}.
    2. NUMERASI (15 Soal): Fokus pada penalaran konteks nyata. Topik: ${mathTopicsStr}.

    LEVEL KOGNITIF:
    - L1 (Pemahaman): 30%
    - L2 (Penerapan): 40%
    - L3 (Penalaran/HOTS): 30%

    PENTING:
    - Gunakan variasi Pilihan Ganda, Pilihan Ganda Kompleks (MCMA), dan Benar/Salah (Kategori).
    - Pastikan 'correctAnswer' untuk Pilihan Ganda Kompleks adalah stringified JSON Array.
    - Pastikan 'correctAnswer' untuk Kategori adalah stringified JSON Object.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: QUESTION_SCHEMA,
        temperature: 0.7
      }
    });

    const results = JSON.parse(response.text);
    
    return results.map((q: any) => {
        let parsedAnswer = q.correctAnswer;
        if (typeof q.correctAnswer === 'string') {
          const trimmed = q.correctAnswer.trim();
          if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
            try {
              parsedAnswer = JSON.parse(trimmed);
            } catch (e) {
              console.warn("Failed to parse JSON answer, keeping as string:", trimmed);
            }
          }
        }
        return { ...q, correctAnswer: parsedAnswer };
    });
  } catch (error) {
    console.error("Critical Error in Gemini TKA Generator:", error);
    throw error;
  }
}
