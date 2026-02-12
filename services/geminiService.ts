
import { GoogleGenAI, Type } from "@google/genai";
import { Question, TopicSelection } from "../types";

/**
 * Utility untuk membersihkan string output AI dari blok JSON Markdown atau karakter sampah.
 * Sangat krusial untuk kestabilan aplikasi setelah deploy.
 */
function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  // Hapus triple backticks jika ada
  cleaned = cleaned.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
  
  // Cari index array pertama [ dan terakhir ] untuk memastikan validitas JSON
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
      subject: { type: Type.STRING, description: "Hanya boleh 'Matematika' atau 'Bahasa Indonesia'" },
      topic: { type: Type.STRING },
      type: { type: Type.STRING, description: "Pilihan Ganda, Pilihan Ganda Kompleks (MCMA), atau Pilihan Ganda Kompleks (Kategori)" },
      cognitiveLevel: { type: Type.STRING, description: "L1 (Pemahaman), L2 (Penerapan), atau L3 (Penalaran)" },
      text: { type: Type.STRING, description: "Pertanyaan utama yang jelas dan menantang" },
      passage: { type: Type.STRING, description: "Teks bacaan atau stimulus (Wajib untuk Literasi dan soal cerita Numerasi)" },
      options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "4-5 pilihan jawaban yang masuk akal (Hanya untuk PG/MCMA)" },
      correctAnswer: { type: Type.STRING, description: "Format: 'A' untuk PG, JSON array string untuk MCMA, atau JSON object string untuk Kategori" },
      categories: { 
        type: Type.ARRAY, 
        items: { 
          type: Type.OBJECT, 
          properties: {
            statement: { type: Type.STRING },
            category: { type: Type.STRING, description: "Benar atau Salah" }
          } 
        },
        description: "Hanya untuk tipe Kategori"
      },
      explanation: { type: Type.STRING, description: "Penjelasan mendalam mengapa jawaban tersebut benar" }
    },
    required: ["id", "subject", "topic", "type", "text", "correctAnswer", "cognitiveLevel", "explanation"]
  }
};

export async function generateTKAQuestions(selectedTopics: TopicSelection): Promise<Question[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const mathTopics = selectedTopics.math.length > 0 ? selectedTopics.math.join(", ") : "Bilangan, Aljabar, Geometri";
  const indTopics = selectedTopics.indonesian.length > 0 ? selectedTopics.indonesian.join(", ") : "Literasi Teks Informasi & Sastra";

  const prompt = `
    Anda adalah Pakar Asesmen Nasional (ANBK) tingkat Internasional.
    Tugas: Buat 30 soal Tes Kemampuan Akademik (TKA) SD kelas 5-6 yang VALID, EFEKTIF, dan BERKUALITAS TINGGI.
    
    KOMPOSISI:
    - 15 Soal Numerasi (Matematika) tentang: ${mathTopics}
    - 15 Soal Literasi (Bahasa Indonesia) tentang: ${indTopics}

    ATURAN KETAT FORMAT JAWABAN:
    1. Jika 'Pilihan Ganda', 'correctAnswer' harus satu huruf besar: "A", "B", "C", atau "D".
    2. Jika 'Pilihan Ganda Kompleks (MCMA)', 'correctAnswer' harus string array JSON valid: ["A", "C"]
    3. Jika 'Pilihan Ganda Kompleks (Kategori)', 'correctAnswer' harus string object JSON valid: {"0": "Benar", "1": "Salah"}
    
    KUALITAS & VALIDASI:
    - Pastikan semua soal memiliki tingkat kognitif yang bervariasi (L1-L3).
    - Soal Literasi HARUS memiliki 'passage' stimulus yang relevan.
    - Soal Numerasi HARUS menggunakan konteks dunia nyata yang logis.
    - Hindari jawaban yang ambigu.
    - Sertakan penjelasan (explanation) yang logis untuk setiap soal.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", // Menggunakan Flash untuk kecepatan maksimal sesuai request
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: QUESTION_SCHEMA,
        temperature: 0.3, // Menjaga konsistensi dan validitas output
        thinkingConfig: { thinkingBudget: 4000 } // Budget yang cukup untuk penalaran soal SD tanpa mengorbankan kecepatan
      }
    });

    const rawText = response.text;
    if (!rawText) throw new Error("AI tidak mengembalikan data.");
    
    const cleanedJson = cleanJsonResponse(rawText);
    const results = JSON.parse(cleanedJson);
    
    if (!Array.isArray(results)) throw new Error("Data hasil generate bukan array valid.");

    return results.map((q: any) => {
        let finalAnswer = q.correctAnswer;
        
        if (typeof q.correctAnswer === 'string') {
          const trimmed = q.correctAnswer.trim();
          if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
            try {
              finalAnswer = JSON.parse(trimmed);
            } catch (e) {
              console.warn("Soft-parse failed for ID:", q.id);
            }
          }
        }

        const subj = (q.subject || "").toLowerCase();
        const normalizedSubject = (subj.includes('mat') || subj.includes('num')) ? 'Matematika' : 'Bahasa Indonesia';

        return { 
          ...q, 
          correctAnswer: finalAnswer,
          subject: normalizedSubject
        };
    });
  } catch (error: any) {
    console.error("GENERATE_CRITICAL_ERROR:", error);
    throw new Error("Sistem AI sedang sibuk atau limit tercapai. Silakan coba lagi dalam beberapa saat.");
  }
}
