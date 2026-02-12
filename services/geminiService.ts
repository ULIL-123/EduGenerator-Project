
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
      cognitiveLevel: { type: Type.STRING, description: "L1, L2, atau L3" },
      text: { type: Type.STRING },
      passage: { type: Type.STRING },
      options: { type: Type.ARRAY, items: { type: Type.STRING } },
      correctAnswer: { type: Type.STRING, description: "Kunci jawaban (String, JSON Array, atau JSON Object)" },
      explanation: { type: Type.STRING }
    },
    required: ["id", "subject", "topic", "type", "text", "correctAnswer", "cognitiveLevel"]
  }
};

export async function generateTKAQuestions(selectedTopics: TopicSelection): Promise<Question[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Bertindaklah sebagai Pakar Pembuat Soal ANBK Kemendikdasmen. 
    Buatlah 20 soal TKA SD (10 Numerasi, 10 Literasi) dengan standar kualitas tinggi.
    
    TOPIK:
    Numerasi: ${selectedTopics.math.join(", ")}
    Literasi: ${selectedTopics.indonesian.join(", ")}

    ATURAN TEKNIS:
    1. Gunakan Bahasa Indonesia formal dan baku.
    2. Variasikan tipe soal: 'Pilihan Ganda', 'Pilihan Ganda Kompleks (MCMA)', dan 'Pilihan Ganda Kompleks (Kategori)'.
    3. Untuk MCMA, 'correctAnswer' HARUS stringified array seperti '["A", "C"]'.
    4. Untuk Kategori, 'correctAnswer' HARUS stringified object seperti '{"0": "Benar", "1": "Salah"}'.
    5. 'passage' hanya diisi jika soal memerlukan bacaan/stimulus panjang.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 }, // Kecepatan maksimal (latency rendah)
        responseMimeType: "application/json",
        responseSchema: QUESTION_SCHEMA,
        temperature: 0.6
      }
    });

    if (!response.text) throw new Error("Respons AI kosong");
    
    const results = JSON.parse(response.text);
    
    return results.map((q: any) => {
        let parsedAnswer = q.correctAnswer;
        // Robust JSON Parsing untuk jawaban kompleks
        if (typeof q.correctAnswer === 'string') {
          const trimmed = q.correctAnswer.trim();
          if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
            try {
              parsedAnswer = JSON.parse(trimmed);
            } catch (e) {
              console.warn("Answer parse fallback:", trimmed);
            }
          }
        }
        return { 
          ...q, 
          correctAnswer: parsedAnswer,
          // Normalisasi tipe subject jika model salah mengembalikan teks
          subject: q.subject.toLowerCase().includes('math') || q.subject.toLowerCase().includes('num') ? 'Matematika' : 'Bahasa Indonesia'
        };
    });
  } catch (error) {
    console.error("Gemini Service Failure:", error);
    throw error;
  }
}
