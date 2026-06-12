import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { onboardingService } from '../../../src/services/onboardingService';
import type { OnboardingStepDetail, OnboardingTaskEndpoint } from '../../../src/types/onboarding';

describe('onboardingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  it('fetchPath: fetches onboarding path for user', async () => {
    const mockPath = { id: 'path-1', userId: 'user-1' };
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPath),
    });

    const path = await onboardingService.fetchPath('user-1');
    
    expect(path).toEqual(mockPath);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/onboarding/user-1/path');
  });

  it('fetchStep: fetches details for a step', async () => {
    const mockStep = { id: 'step-real-1', title: 'Step 1' };
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockStep),
    });

    const step = await onboardingService.fetchStep('step-real-1');
    
    expect(step).toEqual(mockStep);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/onboarding/steps/step-real-1');
  });

  it('updateStepStatus: sends PUT request with updated status', async () => {
    const mockStep = { id: 'step-real-1', position: 1, title: 'Step 1', description: 'Desc', estimatedMinutes: 10 } as unknown as OnboardingStepDetail;
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
    });

    await onboardingService.updateStepStatus(mockStep, 'FINISHED');
    
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/onboarding/steps/step-real-1', expect.objectContaining({
      method: 'PUT',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      body: expect.stringContaining('"status":"FINISHED"')
    }));
  });

  it('skipStep: sends PUT request with SKIPPED status and reason', async () => {
    const mockStep = { id: 'step-real-1', position: 1, title: 'Step 1' } as unknown as OnboardingStepDetail;
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
    });

    await onboardingService.skipStep(mockStep, 'Already know this');
    
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/onboarding/steps/step-real-1', expect.objectContaining({
      method: 'PUT',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      body: expect.stringContaining('"status":"SKIPPED"'),
    }));
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/onboarding/steps/step-real-1', expect.objectContaining({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      body: expect.stringContaining('"skipReason":"Already know this"')
    }));
  });

  it('fetchTasks: fetches tasks for a step', async () => {
    const mockTasks = [{ id: 'task-1', title: 'Task 1' }];
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockTasks),
    });

    const tasks = await onboardingService.fetchTasks('step-real-1');
    
    expect(tasks).toEqual(mockTasks);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/onboarding/steps/step-real-1/tasks');
  });

  it('updateTask: sends PUT request for task', async () => {
    const mockTask = { id: 'task-1', stepId: 'step-real-1', position: 1, title: 'Task 1', description: 'Desc' } as unknown as OnboardingTaskEndpoint;
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
    });

    await onboardingService.updateTask(mockTask, true);
    
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/onboarding/tasks/task-1', expect.objectContaining({
      method: 'PUT',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      body: expect.stringContaining('"finished":true')
    }));
  });
});
