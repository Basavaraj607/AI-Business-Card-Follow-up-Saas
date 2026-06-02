// pages/UploadPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CardCamera } from '../components/CardCapture/CardCamera';
import { CardUpload } from '../components/CardCapture/CardUpload';
import { ContactReview } from '../components/CardCapture/ContactReview';
import { parseCardText, ParsedContact } from '../utils/ai-parser';
import { createClient } from '../lib/supabase/client';
import imageCompression from 'browser-image-compression';
import Tesseract from 'tesseract.js';
import { 
  Camera, Upload, Sparkles, Loader2, ArrowLeft, 
  CheckCircle, RefreshCw, Key, ShieldAlert
} from 'lucide-react';
import toast from 'react-hot-toast';

type ActiveTab = 'camera' | 'upload';
type StepId = 'idle' | 'compress' | 'ocr' | 'parse' | 'review';

interface ProcessingStep {
  id: StepId;
  label: string;
  sub: string;
  status: 'idle' | 'loading' | 'done' | 'error';
}

export function UploadPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ActiveTab>('camera');
  const [currentStep, setCurrentStep] = useState<StepId>('idle');
  
  // OCR & Upload files & paths
  const [localFileUrl, setLocalFileUrl] = useState<string>('');
  const [uploadedPath, setUploadedPath] = useState<string>('');
  const [ocrText, setOcrText] = useState<string>('');
  const [parsedData, setParsedData] = useState<ParsedContact | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);

  // Stepper state
  const [steps, setSteps] = useState<ProcessingStep[]>([]);

  useEffect(() => {
    const key = import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key') || '';
    const hasKey = !!key.trim();
    setHasApiKey(hasKey);
    setSteps([
      { id: 'compress', label: 'Optimize & Upload', sub: 'Compressing and saving to cloud storage', status: 'idle' },
      { 
        id: 'ocr',      
        label: hasKey ? 'AI Vision Scan' : 'Local OCR Scan',     
        sub: hasKey ? 'Analyzing image layout and visual elements' : 'Extracting text directly in browser', 
        status: 'idle' 
      },
      { id: 'parse',    label: 'AI Field Parsing',   sub: 'Structuring details into contact card', status: 'idle' },
    ]);
  }, []);

  const updateStepStatus = (id: StepId, status: 'idle' | 'loading' | 'done' | 'error') => {
    setSteps(prev => prev.map(step => step.id === id ? { ...step, status } : step));
  };

  const resetSteps = () => {
    setSteps(prev => prev.map(step => ({ ...step, status: 'idle' })));
    setCurrentStep('idle');
    setParsedData(null);
    setOcrText('');
    setUploadedPath('');
    if (localFileUrl) {
      URL.revokeObjectURL(localFileUrl);
      setLocalFileUrl('');
    }
  };

  // Main processing pipeline
  const processCard = async (file: File) => {
    // 1. Create a local URL for the preview image
    const previewUrl = URL.createObjectURL(file);
    setLocalFileUrl(previewUrl);
    setCurrentStep('compress');

    const supabase = createClient();
    let finalCompressedFile = file;
    let path = '';

    // Step 1: Compress and Upload
    updateStepStatus('compress', 'loading');
    try {
      // Compress
      finalCompressedFile = await imageCompression(file, { 
        maxSizeMB: 1.2, 
        maxWidthOrHeight: 1600,
        useWebWorker: true 
      });

      // Upload to Supabase Storage
      path = `cards/${crypto.randomUUID()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('card-images')
        .upload(path, finalCompressedFile, { cacheControl: '3600', upsert: false });

      console.debug('Supabase storage.upload response:', { uploadData, uploadError });

      if (uploadError) {
        console.warn('Storage bucket upload failed, using local fallback:', uploadError);
        toast.error(`Cloud upload failed: ${uploadError.message || uploadError.details || uploadError}`);
      } else {
        setUploadedPath(path);
        // confirm public URL is available
        try {
          const { data: publicData } = supabase.storage.from('card-images').getPublicUrl(path);
          console.debug('Public URL:', publicData);
        } catch (e) {
          console.warn('getPublicUrl failed:', e);
        }
      }
      updateStepStatus('compress', 'done');
    } catch (err) {
      console.error('Compression/Upload error:', err);
      updateStepStatus('compress', 'error');
      toast.error('Image optimization failed.');
      return;
    }

    // Step 2: OCR Scanning / AI Vision prepare
    setCurrentStep('ocr');
    updateStepStatus('ocr', 'loading');
    let extractedText = '';
    let imageFileParam: { mimeType: string; base64Data: string } | undefined = undefined;

    if (hasApiKey) {
      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.onerror = (err) => reject(err);
        });
        reader.readAsDataURL(finalCompressedFile);
        const base64Data = await base64Promise;
        imageFileParam = {
          mimeType: finalCompressedFile.type,
          base64Data
        };
        updateStepStatus('ocr', 'done');
      } catch (err) {
        console.error('Base64 conversion error:', err);
        updateStepStatus('ocr', 'error');
        toast.error('Failed to process image for AI vision.');
        return;
      }
    } else {
      try {
        const { data: { text } } = await Tesseract.recognize(finalCompressedFile, 'eng');
        extractedText = text;
        setOcrText(text);

        if (!text.trim()) {
          throw new Error('No text found on card');
        }
        updateStepStatus('ocr', 'done');
      } catch (err) {
        console.error('OCR error:', err);
        updateStepStatus('ocr', 'error');
        toast.error('Failed to extract text. Make sure card is clear.');
        return;
      }
    }

    // Step 3: AI Field Parsing
    setCurrentStep('parse');
    updateStepStatus('parse', 'loading');
    try {
      const data = await parseCardText(extractedText, imageFileParam);
      if (data.rawText) {
        setOcrText(data.rawText);
      }
      setParsedData(data);
      updateStepStatus('parse', 'done');
      setCurrentStep('review');
    } catch (err) {
      console.error('Parsing error:', err);
      updateStepStatus('parse', 'error');
      toast.error('AI contact parsing failed.');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/dashboard')} 
            className="p-2 bg-white border border-gray-100 rounded-lg text-gray-500 hover:text-gray-900 shadow-sm"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Scan Business Card</h1>
            <p className="text-gray-500 text-sm mt-0.5">Extract information and follow-up in seconds</p>
          </div>
        </div>
      </div>

      {/* Settings warning / API Banner if missing */}
      {!hasApiKey && currentStep === 'idle' && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-amber-800">
          <div className="flex items-start gap-3">
            <ShieldAlert size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-sm">No Gemini API Key found</p>
              <p className="text-xs text-amber-700">
                The scanner will use basic regex heuristics. For smart AI contact extraction, set your Gemini API key in Settings or click below.
              </p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/settings')}
            className="btn-secondary btn-sm bg-white border-amber-200 text-amber-800 hover:bg-amber-100 shrink-0 flex items-center gap-1.5"
          >
            <Key size={13} />
            Configure API Key
          </button>
        </div>
      )}

      {/* Processing State */}
      {currentStep === 'idle' ? (
        <div className="grid md:grid-cols-5 gap-6">
          {/* Main capture pane */}
          <div className="md:col-span-3 card p-6 space-y-6">
            
            {/* Tab Toggles */}
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('camera')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer
                  ${activeTab === 'camera' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-800'}`}
              >
                <Camera size={14} />
                Scan with Camera
              </button>
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer
                  ${activeTab === 'upload' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-800'}`}
              >
                <Upload size={14} />
                Upload Image File
              </button>
            </div>

            {/* Selection Content */}
            <div className="min-h-[260px] flex flex-col justify-center">
              {activeTab === 'camera' ? (
                <CardCamera onCapture={processCard} />
              ) : (
                <CardUpload onFile={processCard} />
              )}
            </div>

          </div>

          {/* Quick instructions pane */}
          <div className="md:col-span-2 card p-6 bg-brand-50/20 border-brand-100/50 space-y-5">
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <Sparkles size={18} className="text-brand-600" />
              How it works
            </h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-800 text-xs font-bold flex items-center justify-center shrink-0">1</div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Upload or Capture</p>
                  <p className="text-xs text-gray-500 mt-0.5">Use your mobile/desktop camera or drag an existing card photo.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-800 text-xs font-bold flex items-center justify-center shrink-0">2</div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">OCR Text Extraction</p>
                  <p className="text-xs text-gray-500 mt-0.5">Tesseract.js scans the image locally inside your browser to find textual elements.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-800 text-xs font-bold flex items-center justify-center shrink-0">3</div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">AI Parsing (Gemini)</p>
                  <p className="text-xs text-gray-500 mt-0.5">The OCR text is structured into fields like Name, Title, and Email instantly.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : currentStep !== 'review' ? (
        
        /* Loading Stepper Wizard */
        <div className="card p-8 max-w-xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <Loader2 size={36} className="text-brand-500 animate-spin mx-auto" />
            <h2 className="text-lg font-bold text-gray-900">Processing Business Card</h2>
            <p className="text-xs text-gray-500">Scanning details... please do not close the window.</p>
          </div>

          <div className="space-y-4">
            {steps.map((step) => (
              <div 
                key={step.id} 
                className={`flex gap-4 p-4 rounded-xl border transition-all duration-200
                  ${step.status === 'loading' ? 'bg-brand-50/30 border-brand-100 shadow-sm' : 'bg-white border-gray-100'}
                  ${step.status === 'error' ? 'bg-red-50/30 border-red-100' : ''}
                `}
              >
                <div className="flex items-center justify-center shrink-0">
                  {step.status === 'idle' && (
                    <div className="w-6 h-6 rounded-full border border-gray-200" />
                  )}
                  {step.status === 'loading' && (
                    <div className="w-6 h-6 flex items-center justify-center">
                      <Loader2 size={16} className="text-brand-500 animate-spin" />
                    </div>
                  )}
                  {step.status === 'done' && (
                    <div className="w-6 h-6 bg-brand-100 text-brand-800 rounded-full flex items-center justify-center">
                      <CheckCircle size={16} className="text-brand-600" />
                    </div>
                  )}
                  {step.status === 'error' && (
                    <div className="w-6 h-6 bg-red-100 text-red-800 rounded-full flex items-center justify-center">
                      <ShieldAlert size={16} className="text-red-600" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold 
                    ${step.status === 'loading' ? 'text-brand-800 font-bold' : 'text-gray-800'}
                    ${step.status === 'error' ? 'text-red-800' : ''}
                  `}>
                    {step.label}
                  </p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{step.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {steps.some(s => s.status === 'error') && (
            <button
              onClick={resetSteps}
              className="w-full btn-secondary py-2.5 flex items-center justify-center gap-2 hover:bg-gray-100"
            >
              <RefreshCw size={14} />
              Try scanning again
            </button>
          )}
        </div>
      ) : (
        
        /* Step 4: Side-by-Side Review Stage */
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Card Preview Column */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-semibold text-gray-900 text-sm">Business Card Photo</h3>
            <div className="card p-2 bg-gray-100 rounded-xl overflow-hidden shadow-md flex items-center justify-center max-h-[300px] lg:max-h-none lg:aspect-square">
              {localFileUrl ? (
                <img 
                  src={localFileUrl} 
                  alt="Scanned Business Card" 
                  className="w-full h-full object-contain rounded-lg hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="p-8 text-center text-gray-400">Card Photo Preview</div>
              )}
            </div>
            
            <button
              onClick={resetSteps}
              className="btn-secondary btn-sm w-full py-2.5 flex items-center justify-center gap-2 hover:bg-gray-100"
            >
              <RefreshCw size={12} />
              Re-scan different card
            </button>
          </div>

          {/* Form details Column */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-sm">Confirm Parsed Information</h3>
              <span className="badge badge-green flex items-center gap-1.5">
                <Sparkles size={11} className="text-brand-600 animate-pulse" />
                AI Structured
              </span>
            </div>
            
            <div className="card p-6 shadow-md bg-white">
              {parsedData && (
                <ContactReview 
                  initial={parsedData} 
                  rawOcrText={ocrText} 
                  cardImagePath={uploadedPath} 
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UploadPage;
