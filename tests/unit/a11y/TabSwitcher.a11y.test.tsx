import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { TabSwitcher } from '../../../src/features/admin/components/TabSwitcher';

describe('TabSwitcher Accessibility', () => {
    it('should not have any a11y violations', async () => {
        const onChange = vi.fn();
        // Rendered inside a landmark, as it is on the real page: the bar is now
        // a labelled `group`, and axe's "region" rule wants named regions to
        // live inside one. Testing it bare would fail on the harness, not on
        // the component.
        const { baseElement } = render(
            <MemoryRouter>
                <main>
                    <TabSwitcher activeTab="users" onChange={onChange} />
                </main>
            </MemoryRouter>
        );
        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
