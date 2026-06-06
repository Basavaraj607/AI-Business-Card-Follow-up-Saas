// src/services/inngest.ts

import { supabase } from '../lib/supabase';

export interface InngestEventPayload {
  name: string;
  data: Record<string, any>;
  user?: {
    id: string;
    email?: string;
  };
}

/**
 * Service to queue and schedule Inngest multi-step workflows.
 * Events are proxied through Supabase Edge Functions to ensure keys are never exposed on the client.
 */
class InngestService {
  /**
   * Dispatches an event to the Inngest engine
   */
  async sendEvent(event: InngestEventPayload): Promise<{ success: boolean; data?: any; simulated?: boolean }> {
    try {
      const { data, error } = await supabase.functions.invoke('inngest', {
        headers: {
          'X-Inngest-Action': 'send-event',
        },
        body: event,
      });

      if (error) {
        console.warn('Inngest function returned error:', error);
        throw error;
      }

      return { success: true, data };
    } catch (err) {
      console.warn('Inngest invoke failed; running local sandbox simulation:', err);

      // Local sandbox developer logger
      console.info(
        `[Sandbox Inngest Trigger] Event: ${event.name}\n` +
        `Data:`, event.data
      );

      return { success: true, simulated: true };
    }
  }
}

export const inngest = new InngestService();
