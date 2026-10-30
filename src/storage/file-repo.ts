import fs from 'fs';
import path from 'path';
import { ProtocolEvent, TestRun } from '../types/domain.js';
import { ITestRunRepository } from './repository.js';

export class FileTestRunRepository implements ITestRunRepository {
  private runs: Map<string, TestRun> = new Map();
  private storageFilePath: string;

  constructor(storageDir = path.resolve(process.cwd(), 'data')) {
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    this.storageFilePath = path.join(storageDir, 'runs-history.json');
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.storageFilePath)) {
        const raw = fs.readFileSync(this.storageFilePath, 'utf-8');
        const list: TestRun[] = JSON.parse(raw);
        for (const item of list) {
          this.runs.set(item.runId, item);
        }
      }
    } catch (err) {
      console.warn('[FileRepo] Could not load past runs from disk, starting empty:', err);
    }
  }

  private saveToDisk(): void {
    try {
      const all = Array.from(this.runs.values());
      fs.writeFileSync(this.storageFilePath, JSON.stringify(all, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[FileRepo] Failed to save runs to disk:', err);
    }
  }

  public async createRun(run: TestRun): Promise<void> {
    this.runs.set(run.runId, JSON.parse(JSON.stringify(run)));
    this.saveToDisk();
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
    this.saveToDisk();
    return JSON.parse(JSON.stringify(updated));
  }

  public async appendEvents(runId: string, events: ProtocolEvent[]): Promise<void> {
    const current = this.runs.get(runId);
    if (!current) return;

    current.events.push(...events);
    current.updatedAt = new Date().toISOString();
    this.runs.set(runId, current);
    this.saveToDisk();
  }

  public async listRuns(limit = 50): Promise<TestRun[]> {
    const all = Array.from(this.runs.values());
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return all.slice(0, limit).map((r) => JSON.parse(JSON.stringify(r)));
  }
}
