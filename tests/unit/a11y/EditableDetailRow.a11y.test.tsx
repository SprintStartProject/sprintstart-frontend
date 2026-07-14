import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { EditableDetailRow } from '../../../src/features/admin/components/EditableDetailRow';
import { MemoryRouter } from 'react-router-dom';

describe('EditableDetailRow Accessibility', () => {
    it('should not have any a11y violations', async () => {
        const { baseElement } = render(
            <MemoryRouter>
                <main>
                    <EditableDetailRow 
                        label="Test Label" 
                        value="Test Value" 
                        onChange={vi.fn()} 
                    />
                </main>
            </MemoryRouter>
        );
        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
