/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { 
  BookOpen, 
  Download, 
  Loader2, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Type as TypeIcon, 
  FileText, 
  PenTool,
  ArrowLeft,
  Book
} from 'lucide-react';
import { cn } from './lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// --- Types ---

interface Chapter {
  id: number;
  title: string;
  content: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
}

interface EbookData {
  topic: string;
  author: string;
  tone: string;
  pageCount: number;
  chapters: Chapter[];
  isGeneratingOutline: boolean;
  isGeneratingContent: boolean;
  currentChapterIndex: number;
  error: string | null;
}

// --- App Component ---

export default function App() {
  const [step, setStep] = useState<'form' | 'outline' | 'content' | 'preview'>('form');
  const [formData, setFormData] = useState({
    topic: '',
    author: '',
    tone: 'Professional',
    pageCount: 35,
  });
  
  const [ebook, setEbook] = useState<EbookData>({
    topic: '',
    author: '',
    tone: '',
    pageCount: 0,
    chapters: [],
    isGeneratingOutline: false,
    isGeneratingContent: false,
    currentChapterIndex: -1,
    error: null,
  });

  const ebookRef = useRef<HTMLDivElement>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);

  const generateCover = async () => {
    setIsGeneratingCover(true);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: `A professional, high-quality book cover for an eBook titled "${ebook.topic}". 
              Style: Modern, clean, and professional. 
              The cover should look like a real bestseller book cover. 
              Do not include text if it looks messy, just a beautiful background illustration related to the topic.`,
            },
          ],
        },
      });
      
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          setCoverImage(`data:image/png;base64,${part.inlineData.data}`);
          break;
        }
      }
    } catch (err) {
      console.error('Cover generation failed', err);
    } finally {
      setIsGeneratingCover(false);
    }
  };

  useEffect(() => {
    if (step === 'preview' && !coverImage && !isGeneratingCover) {
      generateCover();
    }
  }, [step]);

  const [loadingMessage, setLoadingMessage] = useState('Menyiapkan pena digital...');

  const loadingMessages = [
    'Menyusun kerangka berpikir...',
    'Mencari referensi terbaik...',
    'Menulis dengan penuh inspirasi...',
    'Memastikan konten orisinal...',
    'Menghaluskan gaya bahasa...',
    'Menambahkan detail praktis...',
    'Menyelesaikan paragraf terakhir...',
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (ebook.isGeneratingContent) {
      interval = setInterval(() => {
        setLoadingMessage(loadingMessages[Math.floor(Math.random() * loadingMessages.length)]);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [ebook.isGeneratingContent]);

  // --- Gemini API ---
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  const generateOutline = async () => {
    setEbook(prev => ({ ...prev, isGeneratingOutline: true, error: null }));
    setStep('outline');

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Buatlah daftar isi (outline) untuk eBook dengan topik: "${formData.topic}". 
        Target pembaca: Pemula dan Profesional. 
        Bahasa: Indonesia yang jelas dan profesional. 
        Ebook ini ditulis oleh: ${formData.author}. 
        Nada tulisan: ${formData.tone}.
        
        Berikan output dalam format JSON array of strings yang berisi judul-judul bab (minimal 10 bab).
        Contoh: ["Bab 1: Pendahuluan", "Bab 2: Dasar-dasar...", ...]`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });

      const titles = JSON.parse(response.text || '[]');
      const chapters: Chapter[] = titles.map((title: string, index: number) => ({
        id: index,
        title,
        content: '',
        status: 'pending'
      }));

      setEbook(prev => ({
        ...prev,
        topic: formData.topic,
        author: formData.author,
        tone: formData.tone,
        pageCount: formData.pageCount,
        chapters,
        isGeneratingOutline: false
      }));
    } catch (err) {
      console.error(err);
      setEbook(prev => ({ ...prev, isGeneratingOutline: false, error: 'Gagal membuat outline. Silakan coba lagi.' }));
    }
  };

  const generateChapterContent = async (index: number) => {
    if (index >= ebook.chapters.length) {
      setEbook(prev => ({ ...prev, isGeneratingContent: false }));
      setStep('preview');
      return;
    }

    setEbook(prev => {
      const newChapters = [...prev.chapters];
      newChapters[index].status = 'generating';
      return { ...prev, chapters: newChapters, currentChapterIndex: index, isGeneratingContent: true };
    });

    try {
      const chapter = ebook.chapters[index];
      const prompt = `Tuliskan isi lengkap untuk bab "${chapter.title}" dari eBook berjudul "${ebook.topic}".
      Penulis: ${ebook.author}.
      Nada: ${ebook.tone}.
      Bahasa: Indonesia yang mengalir, praktis, dan mendalam.
      Gunakan format Markdown (Heading, List, Bold, dll).
      Pastikan konten ini orisinal dan bermanfaat bagi pemula maupun profesional.
      Panjang konten minimal 800 kata untuk bab ini agar mencapai target total halaman eBook.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setEbook(prev => {
        const newChapters = [...prev.chapters];
        newChapters[index].content = response.text || '';
        newChapters[index].status = 'completed';
        return { ...prev, chapters: newChapters };
      });

      // Move to next chapter automatically
      generateChapterContent(index + 1);
    } catch (err) {
      console.error(err);
      setEbook(prev => {
        const newChapters = [...prev.chapters];
        newChapters[index].status = 'error';
        return { ...prev, chapters: newChapters, isGeneratingContent: false, error: `Gagal membuat konten untuk ${ebook.chapters[index].title}` };
      });
    }
  };

  const startContentGeneration = () => {
    setStep('content');
    generateChapterContent(0);
  };

  const exportToPDF = async () => {
    if (!ebookRef.current) return;
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    const content = ebookRef.current;
    
    // Simple PDF generation using text for better quality than canvas if possible, 
    // but for complex markdown, canvas is easier.
    // Let's use html2canvas for a quick high-quality capture of the preview.
    
    const canvas = await html2canvas(content, {
      scale: 2,
      useCORS: true,
      logging: false,
    });
    
    const imgData = canvas.toDataURL('image/png');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    // Handle multi-page
    let heightLeft = pdfHeight;
    let position = 0;
    const pageHeight = pdf.internal.pageSize.getHeight();

    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`${ebook.topic.replace(/\s+/g, '_')}_by_${ebook.author.replace(/\s+/g, '_')}.pdf`);
  };

  const exportToMarkdown = () => {
    let md = `# ${ebook.topic}\n\nBy ${ebook.author}\n\n---\n\n`;
    ebook.chapters.forEach((chapter, idx) => {
      md += `## Bab ${idx + 1}: ${chapter.title}\n\n${chapter.content}\n\n---\n\n`;
    });
    
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ebook.topic.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Render Helpers ---

  const renderForm = () => (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-200 mb-4">
          <BookOpen className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">Aden Generator Ebook AI</h1>
        <p className="text-lg text-gray-600">Ciptakan eBook profesional dan siap jual dalam hitungan menit.</p>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-100 border border-gray-100 space-y-6">
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
            <PenTool className="w-4 h-4 text-orange-500" /> Topik atau Niche Ebook
          </label>
          <input
            type="text"
            placeholder="Contoh: Panduan Investasi Kripto untuk Pemula"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
            value={formData.topic}
            onChange={e => setFormData({ ...formData, topic: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
              <User className="w-4 h-4 text-orange-500" /> Nama Penulis
            </label>
            <input
              type="text"
              placeholder="Nama Anda"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
              value={formData.author}
              onChange={e => setFormData({ ...formData, author: e.target.value })}
            />
          </div>
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
              <TypeIcon className="w-4 h-4 text-orange-500" /> Nada / Gaya Penulisan
            </label>
            <select
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all bg-white"
              value={formData.tone}
              onChange={e => setFormData({ ...formData, tone: e.target.value })}
            >
              <option>Professional</option>
              <option>Santai & Akrab</option>
              <option>Inspiratif</option>
              <option>Teknis & Detail</option>
              <option>To-the-point</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
            <FileText className="w-4 h-4 text-orange-500" /> Target Jumlah Halaman (30-40)
          </label>
          <input
            type="range"
            min="30"
            max="40"
            step="1"
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
            value={formData.pageCount}
            onChange={e => setFormData({ ...formData, pageCount: parseInt(e.target.value) })}
          />
          <div className="flex justify-between text-xs text-gray-500 font-medium">
            <span>30 Halaman</span>
            <span className="text-orange-600 font-bold">{formData.pageCount} Halaman</span>
            <span>40 Halaman</span>
          </div>
        </div>

        <button
          onClick={generateOutline}
          disabled={!formData.topic || !formData.author}
          className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-bold rounded-2xl shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2"
        >
          {ebook.isGeneratingOutline ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-5 h-5" />}
          Mulai Buat Outline
        </button>
      </div>
    </div>
  );

  const renderOutline = () => (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => setStep('form')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
        <span className="px-4 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold uppercase tracking-wider">
          Langkah 2: Outline
        </span>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-100 border border-gray-100 space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">Struktur Ebook Anda</h2>
          <p className="text-gray-500">Kami telah menyusun kerangka bab yang komprehensif untuk Anda.</p>
        </div>

        <div className="space-y-3">
          {ebook.chapters.map((chapter, idx) => (
            <div key={idx} className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-sm font-bold text-gray-500">
                {idx + 1}
              </span>
              <span className="font-medium text-gray-700">{chapter.title}</span>
            </div>
          ))}
        </div>

        {ebook.error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm font-medium">{ebook.error}</p>
          </div>
        )}

        <button
          onClick={startContentGeneration}
          className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2"
        >
          Konfirmasi & Generate Konten
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  const renderContentGeneration = () => (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-bold text-gray-900">Menulis Ebook Anda...</h2>
        <p className="text-orange-600 font-medium animate-pulse">{loadingMessage}</p>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-100 border border-gray-100 space-y-6">
        <div className="space-y-4">
          {ebook.chapters.map((chapter, idx) => (
            <div 
              key={idx} 
              className={cn(
                "flex items-center justify-between p-4 rounded-2xl transition-all border",
                idx === ebook.currentChapterIndex ? "bg-orange-50 border-orange-200 scale-[1.02]" : "bg-white border-gray-100 opacity-60"
              )}
            >
              <div className="flex items-center gap-4">
                <span className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                  chapter.status === 'completed' ? "bg-green-100 text-green-600" : 
                  chapter.status === 'generating' ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-400"
                )}>
                  {chapter.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                </span>
                <span className={cn(
                  "font-medium",
                  idx === ebook.currentChapterIndex ? "text-gray-900" : "text-gray-500"
                )}>
                  {chapter.title}
                </span>
              </div>
              {chapter.status === 'generating' && <Loader2 className="w-5 h-5 animate-spin text-orange-500" />}
            </div>
          ))}
        </div>

        {ebook.error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm font-medium">{ebook.error}</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderPreview = () => (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold text-gray-900">Ebook Selesai!</h2>
          <p className="text-gray-600">Tinjau hasil karya Anda dan ekspor ke PDF.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setStep('form')}
            className="px-6 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-all"
          >
            Buat Baru
          </button>
          <button 
            onClick={exportToMarkdown}
            className="px-6 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-all flex items-center gap-2"
          >
            <FileText className="w-5 h-5" /> Markdown
          </button>
          <button 
            onClick={exportToPDF}
            className="px-6 py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 shadow-lg shadow-orange-200 transition-all flex items-center gap-2"
          >
            <Download className="w-5 h-5" /> Ekspor PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-3xl p-6 shadow-xl shadow-gray-100 border border-gray-100 sticky top-8">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Book className="w-4 h-4 text-orange-500" /> Daftar Isi
            </h3>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {ebook.chapters.map((chapter, idx) => (
                <a 
                  key={idx} 
                  href={`#chapter-${idx}`}
                  className="block p-2 text-sm text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                >
                  {idx + 1}. {chapter.title}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Ebook Content */}
        <div className="lg:col-span-3">
          <div 
            ref={ebookRef}
            className="bg-white rounded-3xl p-12 shadow-2xl shadow-gray-200 border border-gray-100 min-h-[1000px] prose prose-orange max-w-none"
          >
            {/* Cover Page */}
            <div className="text-center space-y-12 py-24 border-b border-gray-100 mb-24">
              {coverImage ? (
                <div className="max-w-md mx-auto rounded-3xl overflow-hidden shadow-2xl mb-12 border-8 border-white">
                  <img src={coverImage} alt="Book Cover" className="w-full h-auto" referrerPolicy="no-referrer" />
                </div>
              ) : isGeneratingCover ? (
                <div className="max-w-md mx-auto aspect-[3/4] bg-gray-100 rounded-3xl flex flex-col items-center justify-center gap-4 mb-12 animate-pulse">
                  <Loader2 className="w-12 h-12 text-orange-200 animate-spin" />
                  <p className="text-gray-400 font-medium">Mendesain Sampul...</p>
                </div>
              ) : null}
              <div className="space-y-4">
                <h1 className="text-6xl font-black text-gray-900 leading-tight uppercase tracking-tighter">
                  {ebook.topic}
                </h1>
                <div className="w-24 h-2 bg-orange-500 mx-auto rounded-full"></div>
              </div>
              <div className="space-y-2">
                <p className="text-xl text-gray-500 font-medium">Ditulis Oleh</p>
                <p className="text-3xl font-bold text-gray-900">{ebook.author}</p>
              </div>
              <div className="pt-12">
                <p className="text-sm text-gray-400 uppercase tracking-[0.3em] font-bold">
                  Aden Generator Ebook AI &copy; 2026
                </p>
              </div>
            </div>

            {/* Chapters */}
            {ebook.chapters.map((chapter, idx) => (
              <div key={idx} id={`chapter-${idx}`} className="mb-24 scroll-mt-8">
                <h2 className="text-4xl font-bold text-gray-900 mb-8 pb-4 border-b-2 border-orange-100">
                  {chapter.title}
                </h2>
                <div className="markdown-content text-gray-700 leading-relaxed text-lg space-y-6">
                  <ReactMarkdown>{chapter.content}</ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-900 font-sans selection:bg-orange-100 selection:text-orange-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight">Aden AI</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-500">
            <span className={cn(step === 'form' && "text-orange-600 font-bold")}>Input</span>
            <ChevronRight className="w-4 h-4" />
            <span className={cn(step === 'outline' && "text-orange-600 font-bold")}>Outline</span>
            <ChevronRight className="w-4 h-4" />
            <span className={cn(step === 'content' && "text-orange-600 font-bold")}>Generate</span>
            <ChevronRight className="w-4 h-4" />
            <span className={cn(step === 'preview' && "text-orange-600 font-bold")}>Export</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-32 pb-24 px-6">
        {step === 'form' && renderForm()}
        {step === 'outline' && renderOutline()}
        {step === 'content' && renderContentGeneration()}
        {step === 'preview' && renderPreview()}
      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-100 text-center text-gray-400 text-sm font-medium">
        <p>&copy; 2026 Aden Generator Ebook AI. All rights reserved.</p>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E5E7EB;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #D1D5DB;
        }
        .markdown-content h1, .markdown-content h2, .markdown-content h3 {
          color: #111827;
          font-weight: 700;
          margin-top: 2rem;
          margin-bottom: 1rem;
        }
        .markdown-content p {
          margin-bottom: 1.5rem;
        }
        .markdown-content ul, .markdown-content ol {
          margin-left: 1.5rem;
          margin-bottom: 1.5rem;
          list-style-type: disc;
        }
        .markdown-content li {
          margin-bottom: 0.5rem;
        }
      `}</style>
    </div>
  );
}
