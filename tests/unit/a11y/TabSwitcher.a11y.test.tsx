import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { TabSwitcher } from '../../../src/features/admin/components/TabSwitcher';

describe('TabSwitcher Accessibility', () => {
    it('should not have any a11y violations', async () => {
        const onChange = vi.fn();
        const { baseElement } = render(
            <MemoryRouter><TabSwitcher activeTab="users" onChange={onChange} /></MemoryRouter>
        );
        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
