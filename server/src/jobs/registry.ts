import { randomUUID } from "node:crypto";
import type { ShoppingDelta } from "../domain/shopping.js";

export type JobStatus = "running" | "done" | "error";

export interface Job {
  id: string;
  status: JobStatus;
  planId: number | null;
  error: string | null;
  weekStart: string;
  createdAt: string;
  /**
   * Optional payload attached when the job settles. Generation jobs leave this
   * null; an adjustment job stores its shopping delta here so the client can
   * show what changed without a second request.
   */
  result: ShoppingDelta | null;
}

/**
 * A store of generation jobs. The running app uses one shared instance
 * (`sharedStore`); tests create isolated stores via `createJobStore()` so state
 * never leaks between cases.
 */
export interface JobStore {
  createJob(weekStart: string): Job;
  getJob(id: string): Job | undefined;
  listJobs(): Job[];
  markDone(id: string, planId: number, result?: ShoppingDelta): void;
  markError(id: string, message: string): void;
}

/** Build a fresh, isolated in-memory job store. */
export function createJobStore(): JobStore {
  // Map preserves insertion order, so listJobs can return newest-first by
  // reversing rather than sorting on createdAt (which has millisecond ties).
  const jobs = new Map<string, Job>();

  return {
    createJob(weekStart) {
      const job: Job = {
        id: randomUUID(),
        status: "running",
        planId: null,
        error: null,
        weekStart,
        createdAt: new Date().toISOString(),
        result: null,
      };
      jobs.set(job.id, job);
      return job;
    },
    getJob(id) {
      return jobs.get(id);
    },
    listJobs() {
      return [...jobs.values()].reverse();
    },
    markDone(id, planId, result) {
      const job = jobs.get(id);
      if (!job) return;
      job.status = "done";
      job.planId = planId;
      if (result !== undefined) job.result = result;
    },
    markError(id, message) {
      const job = jobs.get(id);
      if (!job) return;
      job.status = "error";
      job.error = message;
    },
  };
}

/**
 * The process-wide singleton store the running server shares across requests.
 * The module-level functions below operate on it; `createApp` defaults to it.
 */
export const sharedStore: JobStore = createJobStore();

export const createJob = sharedStore.createJob;
export const getJob = sharedStore.getJob;
export const listJobs = sharedStore.listJobs;
export const markDone = sharedStore.markDone;
export const markError = sharedStore.markError;
