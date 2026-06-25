import React, { useState, useEffect } from 'react';
import { X, Send, Mail, Phone, Link2, Loader2, AlertCircle } from 'lucide-react';

interface MessageSendPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (editedText: string, emailSubject?: string) => Promise<void>;
  channel: 'whatsapp' | 'email' | 'linkedin';
  contactName: string;
  initialMessageText: string;
  initialEmailSubject?: string;
}

export function MessageSendPreviewModal({
  isOpen,
  onClose,
  onConfirm,
  channel,
  contactName,
  initialMessageText,
  initialEmailSubject = 'Follow-up',
}: MessageSendPreviewModalProps) {
  const [editedText, setEditedText] = useState(initialMessageText);
  const [subject, setSubject] = useState(initialEmailSubject);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEditedText(initialMessageText);
      setSubject(initialEmailSubject);
    }
  }, [isOpen, initialMessageText, initialEmailSubject]);

  if (!isOpen) return null;

  const handleSend = async () => {
    setSending(true);
    try {
      await onConfirm(editedText, channel === 'email' ? subject : undefined);
      onClose();
    } catch (err) {
      // Error handling is managed by onConfirm/toast
    } finally {
      setSending(false);
    }
  };

  const getChannelHeader = () => {
    switch (channel) {
      case 'whatsapp':
        return {
          label: 'WhatsApp Message Preview',
          color: 'text-green-600',
          bg: 'bg-green-50',
          icon: Phone,
        };
      case 'linkedin':
        return {
          label: 'LinkedIn Action Preview',
          color: 'text-sky-600',
          bg: 'bg-sky-50',
          icon: Link2,
        };
      case 'email':
      default:
        return {
          label: 'Email Message Preview',
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          icon: Mail,
        };
    }
  };

  const header = getChannelHeader();
  const Icon = header.icon;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in z-10 border border-gray-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${header.bg} flex items-center justify-center`}>
              <Icon size={18} className={header.color} />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-base">{header.label}</h2>
              <p className="text-xs text-gray-500">Review and customize before sending to {contactName}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={sending}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {channel === 'linkedin' ? (
            <div className="p-4 bg-sky-50/50 border border-sky-100 rounded-xl space-y-3">
              <div className="flex gap-2.5 text-sky-800 text-xs font-medium">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>
                  Opening <strong>{contactName}</strong>'s LinkedIn profile.
                  You'll need to send your message manually inside LinkedIn.
                </span>
              </div>
              
              {initialMessageText && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">Suggested Message to Copy</label>
                  <div className="relative">
                    <pre className="p-3 bg-white border border-sky-100 rounded-lg text-xs text-gray-700 leading-relaxed font-mono whitespace-pre-wrap max-h-36 overflow-y-auto select-text">
                      {initialMessageText}
                    </pre>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(initialMessageText);
                        alert('Message copied to clipboard!');
                      }}
                      className="absolute top-2 right-2 px-2 py-1 text-[9px] font-bold bg-sky-50 text-sky-700 rounded border border-sky-100 hover:bg-sky-100"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {channel === 'email' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    disabled={sending}
                    placeholder="Enter email subject..."
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-brand-400 font-medium"
                  />
                </div>
              )}
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500">Message Content</label>
                <textarea
                  value={editedText}
                  onChange={e => setEditedText(e.target.value)}
                  disabled={sending}
                  rows={8}
                  placeholder="Type your message here..."
                  className="w-full text-xs font-mono border border-gray-200 rounded-lg p-3 bg-white focus:outline-none focus:border-brand-400 resize-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button 
            onClick={onClose} 
            disabled={sending}
            className="btn-secondary btn-sm cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="btn-primary btn-sm flex items-center gap-2 cursor-pointer"
          >
            {sending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            {sending ? 'Sending...' : channel === 'linkedin' ? 'Open LinkedIn Profile' : 'Send Message'}
          </button>
        </div>

      </div>
    </div>
  );
}
