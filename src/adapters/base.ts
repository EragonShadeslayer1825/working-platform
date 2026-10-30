import { ProtocolEvent, ProtocolParty, ProtocolType, StageId } from '../types/domain.js';
import { EventSanitizer } from '../engine/event-bus.js';

export abstract class BaseAdapter {
  protected buildEvent(
    stage: StageId,
    protocol: ProtocolType,
    source: ProtocolParty,
    destination: ProtocolParty,
    action: string,
    summary: string,
    rawPayload: Record<string, unknown>,
    httpStatus?: number,
    durationMs?: number
  ): Omit<ProtocolEvent, 'eventId' | 'runId' | 'timestamp'> {
    return {
      stage,
      protocol,
      source,
      destination,
      action,
      payloadSummary: summary,
      rawPayload: (EventSanitizer.sanitize(rawPayload) as Record<string, unknown>) || {},
      httpStatus,
      durationMs,
    };
  }
}
