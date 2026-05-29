import { DocumentStatus, type DocumentMetadata, type UploadResult } from './types';

export const knowledgeService = {
    async fetchDocuments(): Promise<DocumentMetadata[]> {
        await new Promise(resolve => setTimeout(resolve, 800));
        return [
            { id: '1', name: 'Project_Overview.md', size: 1024 * 85, status: DocumentStatus.COMPLETED, uploadDate: new Date(Date.now() - 86400000).toISOString() },
            { id: '2', name: 'Backend_API_Specs.md', size: 1024 * 45, status: DocumentStatus.PROCESSING, uploadDate: new Date(Date.now() - 3600000).toISOString() },
            { id: '3', name: 'Frontend_Architecture.md', size: 1024 * 120, status: DocumentStatus.COMPLETED, uploadDate: new Date(Date.now() - 7200000).toISOString() },
        ];
    },

    async uploadDocuments(files: File[]): Promise<UploadResult[]> {
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        return files.map(file => {
            // Simulate a corrupt file failure if the filename contains "corrupt"
            if (file.name.toLowerCase().includes('corrupt')) {
                return {
                    id: '',
                    filename: file.name,
                    status: 'failed',
                    error: 'File appears to be corrupt or invalid'
                };
            }

            return {
                id: Math.random().toString(36).substring(7),
                filename: file.name,
                status: 'ok'
            };
        });
    },

    async deleteDocument(_id: string): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, 500));
    }
};
