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
  CheckCircle, RefreshCw, Key, ShieldAlert, Trash2, ListOrdered, FileImage
} from 'lucide-react';
import toast from 'react-hot-toast';

interface QueueItem {
  id: string;
  file: File;
  localFileUrl: string;
  status: 'pending' | 'compressing' | 'scanning' | 'parsing' | 'ready' | 'saved' | 'failed';
  progress: number;
  error?: string;
  ocrText?: string;
  uploadedPath?: string;
  dbContactId?: string;
  parsedData: ParsedContact | null;
}

export function UploadPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('camera');
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  
  // Batch queue state
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  useEffect(() => {
    const key = import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key') || '';
    setHasApiKey(!!key.trim());
  }, []);

  // Revoke object URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      queue.forEach(item => {
        if (item.localFileUrl) {
          URL.revokeObjectURL(item.localFileUrl);
        }
      });
    };
  }, [queue]);

  const addFilesToQueue = (files: File[]) => {
    const newItems: QueueItem[] = files.map(file => ({
      id: crypto.randomUUID(),
      file,
      localFileUrl: URL.createObjectURL(file),
      status: 'pending',
      progress: 0,
      parsedData: null,
    }));

    setQueue(prev => [...prev, ...newItems]);
    
    // Select the first item for review if nothing is currently selected
    if (newItems.length > 0) {
      setSelectedItemId(prev => prev || newItems[0].id);
    }

    // Trigger processing for each new item
    newItems.forEach(item => processQueueItem(item));
  };

  const processQueueItem = async (item: QueueItem) => {
    const supabase = createClient();
    
    const updateStatus = (status: QueueItem['status'], progress: number, extra = {}) => {
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status, progress, ...extra } : q));
    };

    try {
      // 1. Optimize & Upload
      updateStatus('compressing', 15);
      const compressedFile = await imageCompression(item.file, { 
        maxSizeMB: 1.2, 
        maxWidthOrHeight: 1600,
        useWebWorker: true 
      });

      const path = `cards/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('card-images')
        .upload(path, compressedFile, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        console.warn('Storage upload failed, using local fallback:', uploadError);
      }
      
      const { data } = supabase.storage.from('card-images').getPublicUrl(path);
      const cardImageUrl = data?.publicUrl || '';

      // 2. Local OCR Scan
      updateStatus('scanning', 45);
      let text = '';
      try {
        const ocrResult = await Tesseract.recognize(compressedFile, 'eng');
        text = ocrResult?.data?.text || '';
      } catch (ocrErr) {
        console.warn('Local Tesseract OCR failed, proceeding to server-side extraction:', ocrErr);
      }

      // 3. AI Field Parsing via Server-Side Edge Function
      updateStatus('parsing', 75);
      let parsedData: ParsedContact;
      let dbContactId: string | undefined;

      try {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key') || '';
        const { data: contactRecord, error: extractError } = await supabase.functions.invoke('extract', {
          body: {
            storagePath: path,
            text: text,
            geminiApiKey: apiKey
          }
        });

        if (extractError || !contactRecord) {
          throw new Error(extractError?.message || 'Failed to extract contact details via Edge Function');
        }

        dbContactId = contactRecord.id;
        parsedData = {
          id: contactRecord.id,
          name: contactRecord.full_name || '',
          email: contactRecord.email || '',
          phone: contactRecord.phone || '',
          company: contactRecord.ai_structured?.company || contactRecord.company_id || '',
          title: contactRecord.role || '',
          website: contactRecord.ai_structured?.website || '',
          linkedin: contactRecord.ai_structured?.linkedin || contactRecord.linkedin_url || '',
          notes: contactRecord.context_notes || '',
          lead_status: contactRecord.lead_status || 'warm',
        };
      } catch (extractErr) {
        console.warn('Edge Function extraction failed, falling back to local regex parser:', extractErr);
        // Fallback to local regex-based parsing
        const localParsed = await parseCardText(text);
        parsedData = localParsed;
      }
      
      // 4. Ready for review
      updateStatus('ready', 100, {
        ocrText: text,
        uploadedPath: path,
        dbContactId,
        parsedData
      });
    } catch (err: any) {
      console.error(`Error processing item ${item.file.name}:`, err);
      updateStatus('failed', 100, { error: err.message || 'Processing failed' });
      toast.error(`Failed to process ${item.file.name}`);
    }
  };

  const retryProcessing = (item: QueueItem) => {
    setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'pending', progress: 0, error: undefined } : q));
    processQueueItem({ ...item, status: 'pending', progress: 0 });
  };

  const removeItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const itemToRemove = queue.find(q => q.id === id);

    setQueue(prev => {
      const filtered = prev.filter(q => q.id !== id);
      // Revoke preview URL
      if (itemToRemove) URL.revokeObjectURL(itemToRemove.localFileUrl);

      // Adjust selection if we removed the currently selected item
      if (selectedItemId === id) {
        const remainingReady = filtered.find(q => q.status === 'ready' || q.status === 'failed');
        setSelectedItemId(remainingReady ? remainingReady.id : (filtered[0]?.id || null));
      }
      return filtered;
    });

    if (itemToRemove?.dbContactId) {
      try {
        const supabase = createClient();
        const { error } = await supabase
          .from('contacts')
          .delete()
          .eq('id', itemToRemove.dbContactId);
        
        if (error) throw error;
        toast.success('Removed card and deleted database draft.');
      } catch (err) {
        console.warn('Failed to delete contact draft from database:', err);
      }
    }
  };

  const handleItemSaved = () => {
    setQueue(prev => {
      const updated = prev.map(q => q.id === selectedItemId ? { ...q, status: 'saved' as const } : q);
      
      // Find the next ready card to auto-advance
      const nextReady = updated.find(q => q.status === 'ready');
      if (nextReady) {
        setSelectedItemId(nextReady.id);
      } else {
        // If no ready card, select the next non-saved item
        const nextPending = updated.find(q => q.status !== 'saved');
        setSelectedItemId(nextPending ? nextPending.id : null);
      }
      return updated;
    });

    toast.success('Contact saved to CRM!');
  };

  const clearCompleted = () => {
    setQueue(prev => {
      const remaining = prev.filter(q => q.status !== 'saved');
      const completed = prev.filter(q => q.status === 'saved');
      completed.forEach(q => URL.revokeObjectURL(q.localFileUrl));
      
      if (remaining.length > 0) {
        setSelectedItemId(remaining[0].id);
      } else {
        setSelectedItemId(null);
      }
      return remaining;
    });
  };

  const resetSteps = () => {
    queue.forEach(item => {
      if (item.localFileUrl) {
        URL.revokeObjectURL(item.localFileUrl);
      }
    });
    setQueue([]);
    setSelectedItemId(null);
  };

  const selectedItem = queue.find(q => q.id === selectedItemId);
  const totalItems = queue.length;
  const processedCount = queue.filter(q => q.status === 'saved').length;
  const isQueueEmpty = totalItems === 0;
  const isAllProcessed = totalItems > 0 && processedCount === totalItems;

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => navigate('/dashboard')} 
          className="p-2 bg-white border border-gray-100 rounded-lg text-gray-500 hover:text-gray-900 shadow-sm transition-all"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scan Business Cards</h1>
          <p className="text-gray-500 text-sm mt-0.5">Capture cards in batches, parse with AI, and review in a queue.</p>
        </div>
      </div>

      {/* Settings warning / API Banner if missing */}
      {!hasApiKey && isQueueEmpty && (
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
            className="btn-secondary btn-sm bg-white border-amber-200 text-amber-800 hover:bg-amber-100 shrink-0 flex items-center gap-1.5 font-bold"
          >
            <Key size={13} />
            Configure API Key
          </button>
        </div>
      )}

      {isQueueEmpty ? (
        /* ── Idle Stage: Capture Panel ── */
        <div className="grid md:grid-cols-5 gap-6">
          <div className="md:col-span-3 card p-6 space-y-6">
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('camera')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer
                  ${activeTab === 'camera' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-800'}`}
              >
                <Camera size={14} />
                Scan with Camera
              </button>
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer
                  ${activeTab === 'upload' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-800'}`}
              >
                <Upload size={14} />
                Upload Image Files
              </button>
            </div>

            <div className="min-h-[280px] flex flex-col justify-center">
              {activeTab === 'camera' ? (
                <CardCamera onCapture={(file) => addFilesToQueue([file])} />
              ) : (
                <CardUpload onFiles={addFilesToQueue} />
              )}
            </div>
          </div>

          <div className="md:col-span-2 card p-6 bg-brand-50/20 border-brand-100/50 space-y-5">
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <Sparkles size={18} className="text-brand-600" />
              Batch Scan Mode
            </h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-800 text-xs font-bold flex items-center justify-center shrink-0">1</div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Upload Multiple Files</p>
                  <p className="text-xs text-gray-500 mt-0.5">Drag-and-drop up to 10 files at once or capture them one after another with your camera.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-800 text-xs font-bold flex items-center justify-center shrink-0">2</div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Concurrent Extraction</p>
                  <p className="text-xs text-gray-500 mt-0.5">The engine compresses, uploads, OCRs, and parses all cards in parallel background tasks.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-800 text-xs font-bold flex items-center justify-center shrink-0">3</div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Verify & Save Queue</p>
                  <p className="text-xs text-gray-500 mt-0.5">Review the structured details side-by-side, tweak values, and click save to load the next card.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : isAllProcessed ? (
        /* ── Batch Complete Celebration Stage ── */
        <div className="card p-12 max-w-xl mx-auto text-center space-y-6 animate-fade-in">
          <div className="w-20 h-20 bg-brand-50 text-brand-600 border border-brand-100 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle size={40} className="text-brand-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-gray-900">Batch Processing Complete! 🎉</h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              You have successfully scanned, verified, and saved all <strong>{totalItems}</strong> business cards directly into your CRM database.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-4 justify-center">
            <button 
              onClick={() => navigate('/contacts')} 
              className="btn-primary py-3 px-6 rounded-xl font-bold shadow-md hover:shadow-lg transition-all"
            >
              View Saved Contacts
            </button>
            <button 
              onClick={resetSteps} 
              className="btn-secondary py-3 px-6 rounded-xl font-bold hover:bg-gray-50 transition-all"
            >
              Scan More Cards
            </button>
          </div>
        </div>
      ) : (
        /* ── Batch Queue Review Workspace Stage ── */
        <div className="grid lg:grid-cols-5 gap-8 items-start">
          
          {/* Left Panel: Queue Status List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                <ListOrdered size={16} className="text-indigo-500" />
                Upload Queue ({processedCount}/{totalItems})
              </h3>
              {processedCount > 0 && (
                <button 
                  onClick={clearCompleted}
                  className="text-xs text-gray-400 hover:text-red-500 font-bold transition-colors"
                >
                  Clear Saved
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {queue.map(item => {
                const isSelected = item.id === selectedItemId;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItemId(item.id)}
                    className={`card p-3 flex items-center gap-3 cursor-pointer transition-all border outline-none
                      ${isSelected 
                        ? 'border-brand-500 bg-brand-50/20 shadow-sm ring-1 ring-brand-400' 
                        : 'border-gray-150 hover:bg-gray-50'
                      }
                      ${item.status === 'saved' ? 'opacity-60 border-green-200 bg-green-50/10' : ''}
                      ${item.status === 'failed' ? 'border-red-200 bg-red-50/10' : ''}
                    `}
                  >
                    {/* Tiny Thumbnail */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 shrink-0 flex items-center justify-center relative">
                      <img 
                        src={item.localFileUrl} 
                        alt="Preview" 
                        className="w-full h-full object-cover" 
                      />
                      {item.status === 'saved' && (
                        <div className="absolute inset-0 bg-brand-500/80 flex items-center justify-center text-white">
                          <CheckCircle size={16} />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-gray-800 truncate">{item.file.name}</p>
                        <button 
                          onClick={(e) => removeItem(item.id, e)}
                          className="text-gray-400 hover:text-red-500 shrink-0 transition-colors p-0.5"
                          title="Remove from queue"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {/* Status / Progress Indicator */}
                      <div className="flex items-center gap-2">
                        {item.status === 'pending' && <span className="text-[10px] text-gray-400 font-medium animate-pulse">Pending...</span>}
                        {item.status === 'compressing' && <span className="text-[10px] text-indigo-500 font-bold">Uploading...</span>}
                        {item.status === 'scanning' && <span className="text-[10px] text-violet-500 font-bold">Local OCR Scan...</span>}
                        {item.status === 'parsing' && <span className="text-[10px] text-pink-500 font-bold">AI Parsing...</span>}
                        {item.status === 'ready' && <span className="text-[10px] text-brand-600 font-bold flex items-center gap-0.5"><Sparkles size={10} /> Ready to Review</span>}
                        {item.status === 'saved' && <span className="text-[10px] text-green-600 font-bold">Saved ✅</span>}
                        {item.status === 'failed' && <span className="text-[10px] text-red-600 font-bold">Failed ⚠️</span>}

                        {item.status !== 'ready' && item.status !== 'saved' && item.status !== 'failed' && item.status !== 'pending' && (
                          <div className="flex-1 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-brand-500 h-full transition-all duration-300" style={{ width: `${item.progress}%` }}></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Camera snapping add-on */}
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <div className="flex bg-gray-100 p-0.5 rounded-lg">
                <button 
                  onClick={() => addFilesToQueue([])} // Trigger file browser via dropzone if needed, but we can display camera
                  className="flex-1 text-center py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 flex items-center justify-center gap-1.5"
                >
                  <Camera size={14} /> Add snap
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel: Workspace (Selected Item Review / Loading) */}
          <div className="lg:col-span-3 space-y-4">
            {selectedItem ? (
              <>
                <div className="flex items-center justify-between border-b border-gray-150 pb-2">
                  <h3 className="font-bold text-gray-900 text-sm">Review Workspace</h3>
                  <div className="text-xs text-gray-400 font-semibold">
                    File: <span className="text-gray-600 font-mono text-[10px]">{selectedItem.file.name}</span>
                  </div>
                </div>

                {/* Processing State */}
                {selectedItem.status === 'saved' ? (
                  <div className="card p-12 bg-green-50/10 border-green-200 text-center space-y-3">
                    <CheckCircle size={32} className="text-green-500 mx-auto" />
                    <h3 className="font-bold text-gray-800 text-sm">Contact Saved Successfully!</h3>
                    <p className="text-xs text-gray-500 max-w-xs mx-auto">
                      This card details were compiled and saved to Supabase CRM. Select another card in the queue to continue.
                    </p>
                  </div>
                ) : selectedItem.status === 'failed' ? (
                  <div className="card p-8 bg-red-50/10 border-red-200 text-center space-y-4">
                    <ShieldAlert size={32} className="text-red-500 mx-auto" />
                    <h3 className="font-bold text-gray-800 text-sm">Processing Failure</h3>
                    <p className="text-xs text-red-700 max-w-xs mx-auto">
                      {selectedItem.error || 'An unexpected error occurred during OCR or AI parsing.'}
                    </p>
                    <button
                      onClick={() => retryProcessing(selectedItem)}
                      className="btn-secondary btn-sm mx-auto flex items-center gap-1 hover:bg-gray-50 font-bold"
                    >
                      <RefreshCw size={12} /> Retry Card
                    </button>
                  </div>
                ) : selectedItem.status !== 'ready' ? (
                  /* Loading display */
                  <div className="card p-12 text-center space-y-4 bg-gray-50/30">
                    <Loader2 size={28} className="animate-spin text-brand-500 mx-auto" />
                    <div className="space-y-1">
                      <h4 className="font-bold text-gray-800 text-sm">
                        {selectedItem.status === 'compressing' && 'Optimizing Image...'}
                        {selectedItem.status === 'scanning' && 'Extracting OCR Text...'}
                        {selectedItem.status === 'parsing' && 'AI Field Structuring...'}
                        {selectedItem.status === 'pending' && 'Queueing...'}
                      </h4>
                      <p className="text-xs text-gray-400">Processing background pipeline. Stand by...</p>
                    </div>
                  </div>
                ) : (
                  /* Review Form loaded with custom values */
                  <div className="grid grid-cols-1 gap-6">
                    {/* Visual Card Image preview header */}
                    <div className="card overflow-hidden p-2 bg-gray-50 flex items-center justify-center max-h-[140px]">
                      <img 
                        src={selectedItem.localFileUrl} 
                        alt="Card" 
                        className="max-h-[120px] object-contain rounded-lg shadow-sm"
                      />
                    </div>

                    <div className="card p-6 shadow-sm bg-white">
                      {selectedItem.parsedData && (
                        <ContactReview 
                          initial={selectedItem.parsedData} 
                          rawOcrText={selectedItem.ocrText || ''} 
                          cardImagePath={selectedItem.uploadedPath || ''} 
                          onSave={handleItemSaved}
                        />
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="card p-12 text-center text-gray-400 text-sm flex flex-col items-center justify-center gap-3">
                <FileImage size={28} />
                <span>Select a processing card from the queue sidebar to review.</span>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

export default UploadPage;
