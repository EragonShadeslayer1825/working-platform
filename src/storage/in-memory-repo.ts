import { ProtocolEvent, TestRun } from '../types/domain.js';
import { ITestRunRepository } from './repository.js';

export class InMemoryTestRunRepository implements ITestRunRepository {
  private runs: Map<string, TestRun> = new Map();

  public async createRun(run: TestRun): Promise<void> {
    this.runs.set(run.runId, JSON.parse(JSON.stringify(run)));
  }

  public async getRun(runId: string): Promise<TestRun | null> {
    const run = this.runs.get(runId);
    if (!run) return null;
    return JSON.parse(JSON.stringify(run));
  }

  public async updateRun(runId: string, updates: Partial<TestRun>): Promise<TestRun | null> {
    const current = this.runs.get(runId);
    if (!current) return null;

    const updated: TestRun = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.runs.set(runId, updated);
    return JSON.parse(JSON.stringify(updated));
  }

  public async appendEvents(runId: string, events: ProtocolEvent[]): Promise<void> {
    const current = this.runs.get(runId);
    if (!current) return;

    current.events.push(...events);
    current.updatedAt = new Date().toISOString();
    this.runs.set(runId, current);
  }

  public async listRuns(limit = 50): Promise<TestRun[]> {
    const all = Array.from(this.runs.values());
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return all.slice(0, limit).map((r) => JSON.parse(JSON.stringify(r)));
  }
}
