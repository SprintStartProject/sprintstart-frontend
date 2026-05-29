import { DocumentStatus, type DocumentMetadata, type UploadResult } from './types';

export const knowledgeService = {
    async fetchDocuments(): Promise<DocumentMetadata[]> {
        // Currently still mocked as there is no GET /v1/uploads endpoint yet
        await new Promise(resolve => setTimeout(resolve, 800));
        return [
            { id: '1', name: 'Project_Overview.md', size: 1024 * 85, status: DocumentStatus.COMPLETED, uploadDate: new Date(Date.now() - 86400000).toISOString() },
            { id: '2', name: 'Backend_API_Specs.md', size: 1024 * 45, status: DocumentStatus.PROCESSING, uploadDate: new Date(Date.now() - 3600000).toISOString() },
            { id: '3', name: 'Frontend_Architecture.md', size: 1024 * 120, status: DocumentStatus.COMPLETED, uploadDate: new Date(Date.now() - 7200000).toISOString() },
        ];
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
