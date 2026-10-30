import { ProtocolEvent, TestRun } from '../types/domain.js';

export interface ITestRunRepository {
  createRun(run: TestRun): Promise<void>;
  getRun(runId: string): Promise<TestRun | null>;
  updateRun(runId: string, updates: Partial<TestRun>): Promise<TestRun | null>;
  appendEvents(runId: string, events: ProtocolEvent[]): Promise<void>;
  listRuns(limit?: number): Promise<TestRun[]>;
}
