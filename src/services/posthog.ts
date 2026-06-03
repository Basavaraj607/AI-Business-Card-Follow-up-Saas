// src/services/posthog.ts

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || '';
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

export interface PostHogEvent {
  name: string;
  properties?: Record<string, any>;
  distinctId: string;
}

/**
 * Lightweight, zero-dependency analytics tracking client for PostHog.
 * Sends captures directly to PostHog's HTTP ingest API.
 */
class PostHogAnalytics {
  private key: string = POSTHOG_KEY;
  private host: string = POSTHOG_HOST;

  constructor() {
    if (!this.key) {
      console.warn('PostHog key is missing. Analytics events will fall back to console logging.');
    }
  }

  /**
   * Tracks an event by sending it to PostHog
   */
  async track(event: PostHogEvent): Promise<void> {
    const payload = {
      api_key: this.key,
      event: event.name,
      properties: {
        distinct_id: event.distinctId,
        $lib: 'web-simple-capture',
        ...event.properties,
      },
      timestamp: new Date().toISOString(),
    };

    // Console logging in dev mode / if key is missing
    console.debug(`[PostHog Capture] Event: ${event.name}`, payload);

    if (!this.key) return;

    try {
      const response = await fetch(`${this.host}/capture/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        mode: 'cors',
      });

      if (!response.ok) {
        console.warn(`PostHog capture request failed with status: ${response.status}`);
      }
    } catch (err) {
      console.warn('Failed to send capture request to PostHog:', err);
    }
  }

  /**
   * Identifies user profiles in PostHog
   */
  async identify(userId: string, traits: Record<string, any>): Promise<void> {
    await this.track({
      name: '$identify',
      distinctId: userId,
      properties: {
        $set: traits,
      },
    });
  }
}

export const analytics = new PostHogAnalytics();
