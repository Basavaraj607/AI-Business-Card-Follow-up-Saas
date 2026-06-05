// pages/SettingsPage.tsx
import { useState, useEffect } from 'react';
import { 
  Key, ShieldAlert, Sparkles, CheckCircle2, AlertCircle, 
  Cpu, Mail, Phone, MessageSquare, Terminal, RefreshCw, Send, CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { notifications } from '../services/notifications';
import { analytics } from '../services/posthog';
import { inngest } from '../services/inngest';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'credentials' | 'sandbox'>('credentials');
  
  // Credentials Tab State
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  // Sandbox Tab State
  const [testChannel, setTestChannel] = useState<'email' | 'sms' | 'whatsapp'>('email');
  const [testRecipient, setTestRecipient] = useState('');
  const [testBody, setTestBody] = useState('Hello from CardFollowup! Testing my integrations.');
  const [sendingTest, setSendingTest] = useState(false);
  const [sandboxLogs, setSandboxLogs] = useState<string[]>([
    'System initialized in Sandbox developer mode.'
  ]);

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

  const handleTriggerTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient.trim() || !testBody.trim()) {
      toast.error('Please enter a recipient and message body.');
      return;
    }

    setSendingTest(true);
    const logTime = () => new Date().toLocaleTimeString();
    
    // Add initiating log
    setSandboxLogs(prev => [
      ...prev,
      `[${logTime()}] Initiating test via channel: ${testChannel.toUpperCase()}`
    ]);

    try {
      // 1. Dispatch event to PostHog
      await analytics.track({
        name: 'test_notification_triggered',
        distinctId: 'sandbox-developer',
        properties: {
          channel: testChannel,
          recipient: testRecipient
        }
      });
      setSandboxLogs(prev => [
        ...prev,
        `[${logTime()}] [PostHog] Analytics event captured: 'test_notification_triggered'`
      ]);

      // 2. Dispatch event to Inngest Scheduler
      const inngestRes = await inngest.sendEvent({
        name: 'cardfollowup/sequence.start',
        data: {
          channel: testChannel,
          to: testRecipient,
          body: testBody,
          delay: '5s' // Short delay for sandbox verification
        }
      });
      setSandboxLogs(prev => [
        ...prev,
        `[${logTime()}] [Inngest] Workflow event 'cardfollowup/sequence.start' queued (Delay: 5s). ${inngestRes.simulated ? '(Simulated)' : ''}`
      ]);

      // 3. Dispatch raw communication
      const notificationRes = await notifications.send({
        channel: testChannel,
        to: testRecipient,
        subject: 'Sandbox Integrations Verification Test',
        body: testBody
      });
      setSandboxLogs(prev => [
        ...prev,
        `[${logTime()}] [Outbound] Dispatch payload processed. Status: Success. ${notificationRes.simulated ? '(Simulated Delivery)' : '(Real Edge Function)'}`
      ]);

      toast.success('Sandbox validation executed! Review Logs below.');
    } catch (err: any) {
      console.error('Sandbox trigger failed:', err);
      setSandboxLogs(prev => [
        ...prev,
        `[${logTime()}] [Error] Operations failed: ${err?.message || JSON.stringify(err)}`
      ]);
      toast.error('Test dispatch failed.');
    } finally {
      setSendingTest(false);
    }
  };



  const toolStack = [
    { name: 'Vercel', type: 'Frontend Host', status: 'Active', color: 'bg-black text-white' },
    { name: 'Supabase Auth', type: 'Authentication', status: 'Active', color: 'bg-emerald-500 text-white' },
    { name: 'Supabase DB', type: 'Postgres Database', status: 'Active', color: 'bg-emerald-600 text-white' },
    { name: 'Supabase Edge Functions', type: 'Backend Runtime', status: 'Active', color: 'bg-emerald-700 text-white' },
    { name: 'Inngest', type: 'Workflow Engine', status: 'Configured', color: 'bg-indigo-600 text-white' },
    { name: 'Resend', type: 'Email Service', status: 'Configured', color: 'bg-slate-800 text-white' },
    { name: 'Twilio', type: 'SMS Gateway', status: 'Configured', color: 'bg-red-600 text-white' },
    { name: 'PostHog', type: 'Event Analytics', status: 'Configured', color: 'bg-orange-500 text-white' },
  ];

  return (
    <div className="space-y-8 max-w-4xl page-enter">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings & Integrations</h1>
        <p className="text-gray-500 text-sm mt-1">Manage API keys, environment integrations, and test notifications</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('credentials')}
          className={`pb-4 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'credentials' 
              ? 'border-brand text-brand' 
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          API Credentials
        </button>
        <button
          onClick={() => setActiveTab('sandbox')}
          className={`pb-4 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'sandbox' 
              ? 'border-brand text-brand' 
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          Developer Sandbox
        </button>
      </div>

      {/* Tab Content 1: Credentials */}
      {activeTab === 'credentials' && (
        <div className="space-y-6 max-w-2xl">
          {/* Gemini API Key */}
          <div className="card p-6 space-y-4 bg-white">
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
                <button type="submit" className="btn-primary btn-sm rounded-lg font-semibold cursor-pointer">
                  Save Key
                </button>
                <button
                  type="button"
                  onClick={testApiKey}
                  disabled={testing || !apiKey.trim()}
                  className="btn-secondary btn-sm flex items-center gap-1.5 rounded-lg font-semibold cursor-pointer"
                >
                  {testing ? (
                    <>
                      <div className="spinner spinner-sm border-gray-300 border-t-brand animate-spin" />
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
                  <button type="button" onClick={handleClear} className="btn-ghost btn-sm text-red-600 hover:bg-red-50 rounded-lg cursor-pointer">
                    Delete Key
                  </button>
                )}
              </div>
            </form>

            {/* Key test indicator */}
            {testResult === 'success' && (
              <div className="p-3 bg-green-50 border border-green-100 rounded-xl flex items-center gap-2 text-sm text-green-800">
                <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                <span>Connection active. Card parsing will use Gemini 1.5 Flash.</span>
              </div>
            )}

            {testResult === 'error' && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-sm text-red-800">
                <AlertCircle size={16} className="text-red-600 shrink-0" />
                <span>Invalid API Key or connection issue. System will fall back to local regex-based parsing.</span>
              </div>
            )}

            {!apiKey.trim() && (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-2 text-sm text-amber-800">
                <ShieldAlert size={16} className="text-amber-600 shrink-0" />
                <span>No API key set. The app will use local regex-based contact extraction as a fallback. Set a key for intelligent AI extraction.</span>
              </div>
            )}
          </div>


        </div>
      )}

      {/* Tab Content 2: Sandbox */}
      {activeTab === 'sandbox' && (
        <div className="space-y-6">
          {/* Dashboard stack checks */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {toolStack.map((tool, idx) => (
              <div key={idx} className="card p-4 flex flex-col justify-between bg-white">
                <div>
                  <span className={`inline-block px-2 py-0.5 text-[9px] font-bold uppercase rounded-md tracking-wider ${tool.color} mb-2`}>
                    {tool.name}
                  </span>
                  <p className="text-xs text-gray-500 font-medium">{tool.type}</p>
                </div>
                <div className="flex items-center gap-1.5 mt-3 text-xs text-green-700 font-semibold">
                  <CheckCircle size={14} className="text-green-500" />
                  {tool.status}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Interactive test trigger */}
            <div className="card p-6 bg-white space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Cpu size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-base">Test Dispatcher</h3>
                  <p className="text-xs text-gray-500">Trigger simulated or live notification executions</p>
                </div>
              </div>

              <form onSubmit={handleTriggerTest} className="space-y-4">
                <div className="input-group">
                  <label className="input-label">Channel Target</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'email', label: 'Email', icon: Mail },
                      { value: 'sms', label: 'SMS', icon: Phone },
                      { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare }
                    ].map(ch => (
                      <button
                        key={ch.value}
                        type="button"
                        onClick={() => {
                          setTestChannel(ch.value as any);
                          setTestRecipient('');
                        }}
                        className={`py-2 px-3 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 cursor-pointer ${
                          testChannel === ch.value 
                            ? 'bg-brand text-white border-brand shadow-sm' 
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <ch.icon size={13} />
                        {ch.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="input-group">
                  <label htmlFor="testRecipient" className="input-label">
                    {testChannel === 'email' ? 'Email Address' : 'Phone Number'}
                  </label>
                  <input
                    id="testRecipient"
                    type={testChannel === 'email' ? 'email' : 'tel'}
                    value={testRecipient}
                    onChange={e => setTestRecipient(e.target.value)}
                    placeholder={testChannel === 'email' ? 'user@domain.com' : '+1234567890'}
                    className="input rounded-xl border-gray-200"
                    required
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="testBody" className="input-label">Message Body</label>
                  <textarea
                    id="testBody"
                    value={testBody}
                    onChange={e => setTestBody(e.target.value)}
                    rows={3}
                    className="input rounded-xl border-gray-200 resize-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={sendingTest || !testRecipient.trim() || !testBody.trim()}
                  className="btn-primary w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  {sendingTest ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      Executing Pipeline...
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      Verify Integrations Pipeline
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Sandbox terminal logs */}
            <div className="card p-6 bg-slate-900 border-slate-950 flex flex-col justify-between h-[420px]">
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 text-slate-200">
                  <Terminal size={16} className="text-brand-400" />
                  <span className="text-sm font-bold font-mono">Sandbox Event Logs</span>
                </div>
                <button
                  onClick={() => setSandboxLogs(['Console logs cleared.'])}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Clear Logs
                </button>
              </div>

              {/* Logs terminal output */}
              <div className="flex-1 overflow-y-auto font-mono text-xs text-slate-300 py-3 space-y-2 select-text scrollbar-thin">
                {sandboxLogs.map((log, idx) => (
                  <p key={idx} className="leading-relaxed whitespace-pre-wrap">
                    {log.startsWith('[Error]') ? (
                      <span className="text-red-400 font-bold">{log}</span>
                    ) : log.includes('[PostHog]') ? (
                      <span className="text-orange-400 font-bold">{log}</span>
                    ) : log.includes('[Inngest]') ? (
                      <span className="text-indigo-400 font-bold">{log}</span>
                    ) : log.includes('[Outbound]') ? (
                      <span className="text-emerald-400 font-bold">{log}</span>
                    ) : (
                      log
                    )}
                  </p>
                ))}
              </div>

              <div className="text-[10px] text-slate-500 font-mono text-center pt-3 border-t border-slate-800">
                Listening for captured events...
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
