import { v4 as uuidv4 } from 'uuid';
import {
  ProtocolEvent,
  ProtocolParty,
  ProtocolType,
  StageId,
} from '../types/domain.js';

export class EventSanitizer {
  private static readonly SENSITIVE_KEYS = [
    'authorization',
    'bearer',
    'token',
    'access_token',
    'refresh_token',
    'client_secret',
    'client_assertion',
    'privatekey',
    'private_key',
    'dpop_proof',
    'national_id',
    'ssn',
    'pin',
    'secret',
    'password',
    'user_pin',
  ];

  public static sanitize(obj: unknown, depth = 0): unknown {
    if (depth > 6) return '[TRUNCATED_MAX_DEPTH]';
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'string') {
      // Redact Bearer token formats in strings
      if (obj.toLowerCase().startsWith('bearer ')) {
        return 'Bearer [REDACTED_TOKEN]';
      }
      // Redact private keys if present in strings
      if (obj.includes('BEGIN PRIVATE KEY')) {
        return '[REDACTED_PRIVATE_KEY]';
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitize(item, depth + 1));
    }

    if (typeof obj === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        const isSensitive = this.SENSITIVE_KEYS.some((sensitive) =>
          lowerKey.includes(sensitive)
        );

        if (isSensitive) {
          sanitized[key] = '[REDACTED_SENSITIVE_DATA]';
        } else {
          sanitized[key] = this.sanitize(value, depth + 1);
        }
      }
      return sanitized;
    }

    return obj;
  }
}

export class ProtocolEventBus {
  public static createEvent(params: {
    runId: string;
    stage: StageId;
    protocol: ProtocolType;
    source: ProtocolParty;
    destination: ProtocolParty;
    action: string;
    payloadSummary: string;
    rawPayload: Record<string, unknown>;
    httpStatus?: number;
    durationMs?: number;
  }): ProtocolEvent {
    const sanitized = EventSanitizer.sanitize(params.rawPayload) as Record<string, unknown>;

    return {
      eventId: uuidv4(),
      runId: params.runId,
      timestamp: new Date().toISOString(),
      stage: params.stage,
      protocol: params.protocol,
      source: params.source,
      destination: params.destination,
      action: params.action,
      payloadSummary: params.payloadSummary,
      rawPayload: sanitized || {},
      httpStatus: params.httpStatus,
      durationMs: params.durationMs,
    };
  }
}
