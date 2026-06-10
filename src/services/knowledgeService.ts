import { DocumentStatus, type DocumentMetadata, type UploadResult } from './types';

/**
 * Service responsible for managing the knowledge base, including file uploads,
 * document retrieval, and deletion.
 */
export const knowledgeService = {
    /**
     * Fetches all documents uploaded by a specific user.
     * 
     * Includes a bypass for the 'test-user-id' to support offline/E2E testing.
     * 
     * @param uploaderId - The unique ID of the user who uploaded the files.
     * @returns A promise resolving to an array of document metadata.
     * @throws Error if the backend request fails.
     */
    async fetchDocuments(uploaderId: string): Promise<DocumentMetadata[]> {
        // --- TESTUSER BYPASS ---
        if (uploaderId === 'test-user-id') {
            return [
                { id: 'doc-1', name: 'Welcome_Guide.pdf', mime: 'application/pdf', status: DocumentStatus.COMPLETED, uploadDate: new Date().toISOString() },
                { id: 'doc-2', name: 'Architecture.png', mime: 'image/png', status: DocumentStatus.PROCESSING, uploadDate: new Date().toISOString() }
            ];
        }
        // -----------------------
        const response = await fetch(`/api/v1/uploads?uploaderId=${uploaderId}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch documents');
        }

        const data = await response.json() as Array<{
            id: string;
            filename: string;
            mime: string;
            uploadedAt: string;
        }>;

        return data.map(item => ({
            id: item.id,
            name: item.filename,
            mime: item.mime,
            status: DocumentStatus.COMPLETED, // Logic for processing status will be added with AI integration
            uploadDate: item.uploadedAt
        }));
    },

    /**
     * Uploads one or more files to the knowledge base.
     * 
     * Files are uploaded sequentially to the backend. Each result indicates 
     * success or contains an error message if the specific file failed.
     * 
     * @param files - Array of File objects to upload.
     * @param uploaderId - The unique ID of the user performing the upload.
     * @returns A promise resolving to an array of UploadResult objects.
     */
    async uploadDocuments(files: File[], uploaderId: string): Promise<UploadResult[]> {
        const results: UploadResult[] = [];
        
        for (const file of files) {
            const formData = new FormData();
            formData.append('files', file);

            try {
                const response = await fetch(`/api/v1/uploads?uploaderId=${uploaderId}`, {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    results.push({
                        id: '',
                        filename: file.name,
                        status: 'failed',
                        error: errorText || response.statusText
                    });
                    continue;
                }

                const uploadResults = await response.json() as UploadResult[];
                results.push(...uploadResults);
            } catch (error) {
                results.push({
                    id: '',
                    filename: file.name,
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        return results;
    },

    /**
     * Deletes a specific document from the knowledge base by its ID.
     * 
     * @param id - The unique identifier of the document to delete.
     * @returns A promise that resolves when the deletion is successful.
     * @throws Error if the deletion fails.
     */
    async deleteDocument(id: string): Promise<void> {
        const response = await fetch(`/api/v1/uploads/${id}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Delete failed: ${errorText || response.statusText}`);
        }
    }
};
