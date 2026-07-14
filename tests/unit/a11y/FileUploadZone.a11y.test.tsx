import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { FileUploadZone } from '../../../src/features/knowledge-base/components/FileUploadZone';

describe('FileUploadZone Accessibility', () => {
    it('has no axe violations and exposes one keyboard upload target', async () => {
        const user = userEvent.setup();
        const onUpload = vi.fn();
        const { baseElement } = render(
            <MemoryRouter><main><FileUploadZone onUpload={onUpload} isUploading={false} /></main></MemoryRouter>
        );

        const uploadTarget = screen.getByRole('button', { name: 'Upload documentation or images' });
        expect(uploadTarget).toHaveClass('w-full');

        await user.tab();
        expect(uploadTarget).toHaveFocus();

        expect(await axe(baseElement)).toHaveNoViolations();
    });

    it('announces invalid file errors', () => {
        const onUpload = vi.fn();
        render(
            <MemoryRouter><main><FileUploadZone onUpload={onUpload} isUploading={false} /></main></MemoryRouter>
        );

        const input = screen.getByLabelText('Upload files');
        const file = new File(['content'], 'malware.exe', { type: 'application/x-msdownload' });
        fireEvent.change(input, { target: { files: [file] } });

        expect(screen.getByRole('alert')).toHaveTextContent('File type not supported');
        expect(onUpload).not.toHaveBeenCalled();
    });
});
