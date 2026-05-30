// pages/SettingsPage.tsx
import { useState, useEffect } from 'react';
import { Key, Database, ShieldAlert, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key') || '';
    setApiKey(savedKey);
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('gemini_api_key', apiKey.trim());
    toast.success('Settings saved successfully!');
  };

  const handleClear = () => {
    localStorage.removeItem('gemini_api_key');
    setApiKey('');
    setTestResult(null);
    toast.success('API Key removed');
  };

  const testApiKey = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter an API Key first');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: 'Respond with the word "Success" if you can read this.',
                  },
                ],
              },
            ],
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.toLowerCase().includes('success')) {
          setTestResult('success');
          toast.success('API Key is valid!');
        } else {
          setTestResult('error');
          toast.error('API Key returned unexpected response.');
        }
      } else {
        setTestResult('error');
        toast.error(`Invalid API Key (HTTP ${response.status})`);
      }
    } catch (err) {
      setTestResult('error');
      toast.error('API Test failed. Check your internet connection.');
      console.error(err);
    } finally {
      setTesting(false);
    }
  };

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'Not Configured';

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Configure your integrations and credentials</p>
      </div>

      <div className="space-y-6">
        {/* Gemini API Key */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <Key size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-base">Gemini API Configuration</h3>
              <p className="text-xs text-gray-500">Power business card details parsing and OCR enhancements</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="input-group">
              <label htmlFor="apiKey" className="input-label">Gemini API Key</label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="input font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">
                Your key is stored locally in your browser's storage and never sent to any server other than Google's Gemini API directly.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="submit" className="btn-primary btn-sm">
                Save Key
              </button>
              <button
                type="button"
                onClick={testApiKey}
                disabled={testing || !apiKey.trim()}
                className="btn-secondary btn-sm flex items-center gap-1.5"
              >
                {testing ? (
                  <>
                    <div className="spinner spinner-sm border-gray-300 border-t-brand-400 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Test Connection
                  </>
                )}
              </button>
              {apiKey.trim() && (
                <button type="button" onClick={handleClear} className="btn-ghost btn-sm text-red-600 hover:bg-red-50">
                  Delete Key
                </button>
              )}
            </div>
          </form>

          {/* Key test indicator */}
          {testResult === 'success' && (
            <div className="p-3 bg-green-50 border border-green-100 rounded-lg flex items-center gap-2 text-sm text-green-800">
              <CheckCircle2 size={16} className="text-green-600 shrink-0" />
              <span>Connection active. Card parsing will use Gemini 1.5 Flash.</span>
            </div>
          )}

          {testResult === 'error' && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-sm text-red-800">
              <AlertCircle size={16} className="text-red-600 shrink-0" />
              <span>Invalid API Key or connection issue. System will fall back to local regex-based parsing.</span>
            </div>
          )}

          {!apiKey.trim() && (
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-center gap-2 text-sm text-amber-800">
              <ShieldAlert size={16} className="text-amber-600 shrink-0" />
              <span>No API key set. The app will use local regex-based contact extraction as a fallback. Set a key for intelligent AI extraction.</span>
            </div>
          )}
        </div>

        {/* Database / Supabase */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Database size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-base">Backend & Storage</h3>
              <p className="text-xs text-gray-500">Infrastructure settings loaded from environment</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 py-1 text-sm border-b border-gray-100">
              <span className="text-gray-500">Supabase Endpoint</span>
              <span className="col-span-2 font-mono text-xs text-gray-700 truncate">{supabaseUrl}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-1 text-sm border-b border-gray-100">
              <span className="text-gray-500">Storage Bucket</span>
              <span className="col-span-2 text-gray-700">card-images</span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-1 text-sm">
              <span className="text-gray-500">Tables</span>
              <span className="col-span-2 text-gray-700 font-mono text-xs">contacts, tenants, profiles, messages</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
