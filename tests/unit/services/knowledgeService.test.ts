import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { knowledgeService } from '../../../src/services/knowledgeService';

describe('knowledgeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  it('fetchDocuments: uses testuser bypass for "test-user-id"', async () => {
    const docs = await knowledgeService.fetchDocuments('test-user-id');
    
    expect(docs).toHaveLength(2);
    expect(docs[0].id).toBe('doc-1');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('fetchDocuments: calls API and maps response correctly', async () => {
    const mockData = [
      { id: '1', filename: 'test.pdf', mime: 'application/pdf', uploadedAt: '2023-01-01' }
    ];
    
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const docs = await knowledgeService.fetchDocuments('real-user-id');
    
    expect(docs).toHaveLength(1);
    expect(docs[0].name).toBe('test.pdf');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/uploads?uploaderId=real-user-id');
  });

  it('uploadDocuments: handles multiple files and captures errors', async () => {
    const file1 = new File(['content'], 'file1.txt', { type: 'text/plain' });
    const file2 = new File(['content'], 'file2.txt', { type: 'text/plain' });
    
    // Mock first upload success
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ id: '1', filename: 'file1.txt', status: 'success' }]),
    });
    
    // Mock second upload failure
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad Request',
      text: () => Promise.resolve('Invalid file type'),
    });

    const results = await knowledgeService.uploadDocuments([file1, file2], 'user-123');
    
    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('success');
    expect(results[1].status).toBe('failed');
    expect(results[1].error).toBe('Invalid file type');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('deleteDocument: calls DELETE endpoint', async () => {
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
    });

    await knowledgeService.deleteDocument('doc-123');
    
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/uploads/doc-123', expect.objectContaining({
      method: 'DELETE'
    }));
  });

  it('deleteDocument: throws error on failure', async () => {
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
      text: () => Promise.resolve('Document does not exist'),
    });

    await expect(knowledgeService.deleteDocument('invalid-id')).rejects.toThrow('Delete failed: Document does not exist');
  });
});
