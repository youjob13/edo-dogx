import type { FastifyReply } from 'fastify';

interface NotificationEvent {
  type: 'ready' | 'notification' | 'read';
  payload: Record<string, unknown>;
};

class NotificationSseHub {
  private readonly subscribers = new Map<string, Set<FastifyReply>>();

  subscribe(userId: string, reply: FastifyReply): void {
    const set = this.subscribers.get(userId) ?? new Set<FastifyReply>();
    set.add(reply);
    this.subscribers.set(userId, set);
  }

  unsubscribe(userId: string, reply: FastifyReply): void {
    const set = this.subscribers.get(userId);
    if (!set) {
      return;
    }
    set.delete(reply);
    if (set.size === 0) {
      this.subscribers.delete(userId);
    }
  }

  publish(userId: string, event: NotificationEvent): void {
    const set = this.subscribers.get(userId);
    if (!set) {
      return;
    }

    const data = `event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`;
    for (const reply of set) {
      void reply.raw.write(data);
    }
  }
}

export const notificationSseHub = new NotificationSseHub();
