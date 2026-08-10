import { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { UploadArtifactPanel } from './UploadArtifactPanel';

/**
 * Props for the UploadArtifactModal component.
 */
interface UploadArtifactModalProps {
    /** Whether the modal is currently visible. */
    isOpen: boolean;
    /** Called when the modal should close. */
    onClose: () => void;
    /** Project the uploaded artifacts belong to. */
    projectId: string;
    /** Called after a successful upload so the caller can refresh its list. */
    onUploadSuccess?: () => void;
    /** Heading shown in the modal header. */
    title?: string;
}

/**
 * Dialog wrapper around `UploadArtifactPanel`.
 *
 * It used to reimplement the focus trap, Escape handling and focus restore that
 * `Modal` already does — roughly a hundred lines that had to be kept in step
 * with the original by hand. All of that now comes from `Modal`; what is left
 * here is the one thing specific to uploading: the dialog must not be
 * dismissable while files are in flight, because closing it would abandon the
 * upload without telling anyone.
 */
export function UploadArtifactModal({
    isOpen,
    onClose,
    projectId,
    onUploadSuccess,
    title = 'Upload Artifacts',
}: UploadArtifactModalProps) {
    const [isUploading, setIsUploading] = useState(false);

    return (
        <Modal
            isOpen={isOpen}
            title={title}
            size="lg"
            onClose={onClose}
            closeLabel="Close upload modal"
            isDismissDisabled={isUploading}
            testId="upload-modal"
            bodyClassName="max-h-[70vh] overflow-y-auto px-6 py-6"
        >
            <UploadArtifactPanel
                projectId={projectId}
                onUploadSuccess={onUploadSuccess}
                onFinished={onClose}
                onUploadingChange={setIsUploading}
            />
        </Modal>
    );
}
