// hooks/useCardProcess.ts
import { useState } from 'react';
import { createClient } from '../lib/supabase/client';
import Tesseract from 'tesseract.js'; // npm i tesseract.js
import imageCompression from 'browser-image-compression'; // npm i browser-image-compression

type StepStatus = 'idle' | 'loading' | 'done' | 'error';

interface ProcessStep {
  id: string;
  label: string;
  sub: string;
  status: StepStatus;
}

// Minimal parsed contact shape used by the hook
type ParsedContact = {
  name?: string
  email?: string
  phone?: string
  [key: string]: any
}

export function useCardProcess() {
  const [steps, setSteps] = useState<ProcessStep[]>([
    { id: 'upload',  label: 'Upload to storage', sub: 'Supabase Storage bucket', status: 'idle' },
    { id: 'ocr',     label: 'OCR extraction',    sub: 'Tesseract.js',             status: 'idle' },
    { id: 'parse',   label: 'AI contact parsing', sub: 'Groq · Llama 3.1 8B',    status: 'idle' },
    { id: 'review',  label: 'Ready to review',    sub: 'Confirm extracted fields', status: 'idle' },
  ]);
  const [result, setResult] = useState<ParsedContact | null>(null);

  const setStep = (id: string, status: StepStatus) =>
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s));

  async function process(file: File) {
    const supabase = createClient();

    // Step 1 — compress + upload
    setStep('upload', 'loading');
    const compressed = await imageCompression(file, { maxSizeMB: 1.5, maxWidthOrHeight: 1800 });
    const path = `cards/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from('card-images').upload(path, compressed);
    if (error) { setStep('upload', 'error'); return; }
    setStep('upload', 'done');

    // Step 2 — OCR in the browser (no API key needed)
    setStep('ocr', 'loading');
    const { data: { text, confidence } } = await Tesseract.recognize(compressed, 'eng');
    setStep('ocr', 'done');

    // Step 3 — send raw text to your API → Groq parses it
    setStep('parse', 'loading');
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, confidence, storagePath: path }),
    });
    const contact = await res.json();
    setResult(contact);
    setStep('parse', 'done');
    setStep('review', 'done');
  }

  return { steps, result, process };
}