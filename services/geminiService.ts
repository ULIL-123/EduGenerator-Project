
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
      cognitiveLevel: { type: Type.STRING, description: "L1, L2, atau L3" },
      text: { type: Type.STRING, description: "Pertanyaan utama" },
      passage: { type: Type.STRING, description: "Teks bacaan (Wajib untuk Literasi)" },
      options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "4-5 pilihan jawaban (Hanya untuk PG/MCMA)" },
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
      explanation: { type: Type.STRING, description: "Penjelasan rasional AI" }
    },
    required: ["id", "subject", "topic", "type", "text", "correctAnswer", "cognitiveLevel"]
  }
};

export async function generateTKAQuestions(selectedTopics: TopicSelection): Promise<Question[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const mathTopics = selectedTopics.math.length > 0 ? selectedTopics.math.join(", ") : "Bilangan, Aljabar, Geometri";
  const indTopics = selectedTopics.indonesian.length > 0 ? selectedTopics.indonesian.join(", ") : "Literasi Teks Informasi & Sastra";

  // Prompt yang jauh lebih ketat untuk hasil profesional
  const prompt = `
    Anda adalah Pakar Asesmen Nasional (ANBK). 
    Tugas: Buat 20 soal Tes Kemampuan Akademik (TKA) SD kelas 5-6 yang berkualitas tinggi.
    
    KOMPOSISI:
    - 10 Soal Numerasi (Matematika) tentang: ${mathTopics}
    - 10 Soal Literasi (Bahasa Indonesia) tentang: ${indTopics}

    ATURAN KETAT FORMAT JAWABAN:
    1. Jika 'Pilihan Ganda', 'correctAnswer' harus berupa satu huruf besar: "A" atau "B" dsb.
    2. Jika 'Pilihan Ganda Kompleks (MCMA)', 'correctAnswer' harus berupa string array JSON: ["A", "C"]
    3. Jika 'Pilihan Ganda Kompleks (Kategori)', 'correctAnswer' harus berupa string object JSON: {"0": "Benar", "1": "Salah"}
    
    KUALITAS:
    - Gunakan Bahasa Indonesia Baku.
    - Soal Literasi WAJIB memiliki 'passage' yang relevan dan mendalam.
    - Soal Numerasi harus memiliki konteks kehidupan nyata (Higher Order Thinking Skills/HOTS).
    - Variasikan tingkat kognitif antara L1 (Pemahaman), L2 (Penerapan), dan L3 (Penalaran).
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // Menggunakan model Pro untuk kualitas TKA terbaik
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: QUESTION_SCHEMA,
        temperature: 0.4,
        thinkingConfig: { thinkingBudget: 4000 } // Memberi waktu AI untuk memecahkan soal matematika dengan benar
      }
    });

    const rawText = response.text;
    if (!rawText) throw new Error("AI tidak mengembalikan data.");
    
    const cleanedJson = cleanJsonResponse(rawText);
    const results = JSON.parse(cleanedJson);
    
    if (!Array.isArray(results)) throw new Error("Data hasil generate bukan array valid.");

    return results.map((q: any) => {
        let finalAnswer = q.correctAnswer;
        
        // Proteksi parsing untuk field correctAnswer yang mungkin dikirim AI dalam bentuk string terenkapsulasi
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

        // Normalisasi Subjek untuk UI konsistensi
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
