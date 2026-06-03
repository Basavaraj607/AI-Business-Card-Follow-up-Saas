// src/services/notifications.ts

import { supabase } from '../lib/supabase';

export interface CommunicationPayload {
  channel: 'email' | 'sms' | 'whatsapp';
  to: string;
  subject?: string;
  body: string;
  contactId?: string;
}

/**
 * Service to dispatch outbound follow-ups (Email, SMS, or WhatsApp)
 * by invoking the Supabase Edge Function that connects to Resend, Twilio, or Meta API.
 */
class NotificationService {
  async send(payload: CommunicationPayload): Promise<{ success: boolean; data?: any; simulated?: boolean }> {
    try {
      // Invoke the backend Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('send-communication', {
        body: payload,
      });

      if (error) {
        console.warn('Supabase Edge Function send-communication returned error:', error);
        throw error;
      }

      return { success: true, data };
    } catch (err) {
      console.warn('Edge function invoke failed; running mock sandbox simulation:', err);
      
      // Developer sandbox simulation fallback
      console.info(
        `[Sandbox Communication Send] Channel: ${payload.channel.toUpperCase()}\n` +
        `To: ${payload.to}\n` +
        `Subject: ${payload.subject || 'N/A'}\n` +
        `Body:\n"${payload.body}"`
      );

      return { success: true, simulated: true };
    }
  }
}

export const notifications = new NotificationService();
