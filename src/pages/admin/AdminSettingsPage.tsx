// src/pages/admin/AdminSettingsPage.tsx

import { useEffect, useState } from 'react';
import { 
  Settings, 
  ShieldAlert, 
  Loader2, 
  Save, 
  Mail, 
  Phone, 
  MessageSquareCode,
  Gauge
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import type { PlatformSettings } from '../../types/database';
import { AdminSubNav } from './AdminOverviewPage';
import toast from 'react-hot-toast';

export function AdminSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await adminService.getSettings();
      setSettings(res);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch platform settings');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleToggleMaintenance = () => {
    if (!settings) return;
    setSettings({
      ...settings,
      maintenance_mode: !settings.maintenance_mode
    });
  };

  const handleInputChange = (field: keyof PlatformSettings, value: any) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [field]: value
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    const loadingToast = toast.loading('Saving platform settings...');
    try {
      await adminService.updateSettings(settings);
      toast.success('Settings updated successfully!', { id: loadingToast });
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings', { id: loadingToast });
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-12">
        <ShieldAlert className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-gray-900">Failed to load platform settings</h3>
        <p className="text-gray-500">Please make sure the platform_settings table has a "global" row seeded.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">System Parameters</h1>
        <p className="text-sm text-gray-500">Configure global quotas, maintenance operations, and default integration secrets.</p>
      </div>

      <AdminSubNav />

      <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
        
        {/* Maintenance Toggle */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-bold text-gray-900 text-sm">System Maintenance Mode</h3>
            <p className="text-xs text-gray-500 max-w-lg">
              Locks all regular user operations. Useful during database upgrades, security patches, or server migrations.
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleMaintenance}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm border ${
              settings.maintenance_mode 
                ? 'bg-red-650 hover:bg-red-700 text-white border-red-750' 
                : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
            }`}
          >
            <ShieldAlert size={14} />
            {settings.maintenance_mode ? 'Maintenance Active' : 'Maintenance Offline'}
          </button>
        </div>

        {/* Quotas & Resources */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <Gauge size={18} className="text-indigo-500" />
            <h3 className="font-bold text-gray-900 text-sm">Default Plan Limits</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Max Contacts Limit (Free Plan)</label>
              <input
                type="number"
                value={settings.max_contacts_limit}
                onChange={(e) => handleInputChange('max_contacts_limit', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-250 focus:bg-white focus:border-indigo-500 rounded-lg outline-none transition-all"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Max Messages Limit (Free Plan)</label>
              <input
                type="number"
                value={settings.max_messages_limit}
                onChange={(e) => handleInputChange('max_messages_limit', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-250 focus:bg-white focus:border-indigo-500 rounded-lg outline-none transition-all"
                required
              />
            </div>
          </div>
        </div>

        {/* Integration Credentials */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <Settings size={18} className="text-indigo-500" />
            <h3 className="font-bold text-gray-900 text-sm">Default API Credentials</h3>
          </div>

          {/* Resend Integration */}
          <div className="space-y-4">
            <h4 className="font-bold text-gray-800 text-xs flex items-center gap-2"><Mail size={14} className="text-gray-400" /> Resend Integration (Email)</h4>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">API Access Token</label>
              <input
                type="password"
                placeholder="re_..."
                value={settings.default_resend_key}
                onChange={(e) => handleInputChange('default_resend_key', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-lg outline-none transition-all font-mono"
              />
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Twilio Integration */}
          <div className="space-y-4">
            <h4 className="font-bold text-gray-800 text-xs flex items-center gap-2"><Phone size={14} className="text-gray-400" /> Twilio Integration (SMS)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500">Account SID</label>
                <input
                  type="text"
                  placeholder="AC..."
                  value={settings.default_twilio_sid}
                  onChange={(e) => handleInputChange('default_twilio_sid', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-lg outline-none transition-all font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500">Auth Token</label>
                <input
                  type="password"
                  placeholder="••••••••••••••••••••••••••••••••"
                  value={settings.default_twilio_token}
                  onChange={(e) => handleInputChange('default_twilio_token', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-lg outline-none transition-all font-mono"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">Sender Phone Number</label>
              <input
                type="text"
                placeholder="+1..."
                value={settings.default_twilio_phone}
                onChange={(e) => handleInputChange('default_twilio_phone', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-lg outline-none transition-all font-mono"
              />
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Meta Whatsapp Integration */}
          <div className="space-y-4">
            <h4 className="font-bold text-gray-800 text-xs flex items-center gap-2"><MessageSquareCode size={14} className="text-gray-400" /> Meta WhatsApp Cloud Integration</h4>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500">Permanent Access Token</label>
                <input
                  type="password"
                  placeholder="EAAB..."
                  value={settings.default_meta_token}
                  onChange={(e) => handleInputChange('default_meta_token', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-lg outline-none transition-all font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500">Phone Number ID</label>
                <input
                  type="text"
                  placeholder="109..."
                  value={settings.default_meta_phone_id}
                  onChange={(e) => handleInputChange('default_meta_phone_id', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 focus:bg-white focus:border-indigo-500 rounded-lg outline-none transition-all font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 transition-all shadow"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={16} />}
            Save Parameters
          </button>
        </div>

      </form>
    </div>
  );
}
