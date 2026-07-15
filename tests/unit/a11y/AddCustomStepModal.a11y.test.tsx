import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import { AddCustomStepModal } from '../../../src/features/team-management/components/detail/AddCustomStepModal';

function AddCustomStepModalHarness() {
    const [isOpen, setIsOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [expectedOutcome, setExpectedOutcome] = useState('');
    const [estimatedMinutes, setEstimatedMinutes] = useState('30');
    const [tasks, setTasks] = useState([{ title: '', description: '' }]);

    return (
        <main>
            <button type="button" onClick={() => setIsOpen(true)}>
                Open add step
            </button>
            <AddCustomStepModal
                open={isOpen}
                title={title}
                description={description}
                expectedOutcome={expectedOutcome}
                estimatedMinutes={estimatedMinutes}
                tasks={tasks}
                addingStep={false}
                errorMessage=""
                onTitleChange={setTitle}
                onDescriptionChange={setDescription}
                onExpectedOutcomeChange={setExpectedOutcome}
                onEstimatedMinutesChange={setEstimatedMinutes}
                onTasksChange={setTasks}
                onClose={() => setIsOpen(false)}
                onSubmit={vi.fn()}
            />
        </main>
    );
}

describe('AddCustomStepModal Accessibility', () => {
    it('has no axe violations and keeps focus inside the modal', async () => {
        const userEventInstance = userEvent.setup();
        const { baseElement } = render(
            <MemoryRouter>
                <AddCustomStepModalHarness />
            </MemoryRouter>
        );

        await userEventInstance.click(screen.getByRole('button', { name: 'Open add step' }));

        const dialog = await screen.findByRole('dialog', { name: 'Add Custom Step' });
        await waitFor(() => {
            const closeButton = within(dialog).getByRole('button', { name: 'Close add step modal' });
            expect(closeButton).toHaveFocus();
        });

        expect(screen.getByLabelText('Step title *')).toBeInTheDocument();
        expect(screen.getByLabelText('Est. minutes *')).toBeInTheDocument();

        expect(await axe(baseElement)).toHaveNoViolations();
    });
});
