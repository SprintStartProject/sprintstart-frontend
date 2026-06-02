import { DocumentStatus, type DocumentMetadata, type UploadResult } from './types';

export const knowledgeService = {
    async fetchDocuments(uploaderId: string): Promise<DocumentMetadata[]> {
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
