import { DocumentStatus, type DocumentMetadata, type UploadResult } from './types';

export const knowledgeService = {
    async fetchDocuments(uploaderId: string): Promise<DocumentMetadata[]> {
        const response = await fetch(`/v1/uploads?uploaderId=${uploaderId}`);
        
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
        const formData = new FormData();
        files.forEach(file => {
            formData.append('files', file);
        });

        const response = await fetch(`/v1/uploads?uploaderId=${uploaderId}`, {
            method: 'POST',
            body: formData,
            // Note: Don't set Content-Type header; fetch will set it automatically for FormData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upload failed: ${errorText || response.statusText}`);
        }

        return await response.json() as UploadResult[];
    },

    async deleteDocument(_id: string): Promise<void> {
        // Mocked until DELETE endpoint is available
        await new Promise(resolve => setTimeout(resolve, 500));
    }
};
