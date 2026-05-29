export enum Role {
    NO_ROLE = 'NO_ROLE',
    EXISTING_MEMBER = 'EXISTING_MEMBER',
    NEW_MEMBER = 'NEW_MEMBER',
    ADMIN = 'ADMIN',
}

export enum WorkingArea {
    NO_WORKING_AREA = 'NO_WORKING_AREA',
    FRONTEND_DEV = 'FRONTEND_DEV',
    BACKEND_DEV = 'BACKEND_DEV',
    DEV_OPS = 'DEV_OPS',
    QA = 'QA',
    HR = 'HR',
}

export enum DocumentStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
}

export type DocumentMetadata = {
    id: string;
    name: string;
    mime: string;
    size?: number;
    status: DocumentStatus;
    uploadDate: string;
};

export type UploadResult = {
    id: string;
    filename: string;
    status: 'ok' | 'failed';
    error?: string;
};

export interface UserProfile {
    id: string;
    username: string;
    firstname: string;
    lastname: string;
    primaryRole: Role;
    secondaryRole: Role;
    workingArea: WorkingArea;
}
