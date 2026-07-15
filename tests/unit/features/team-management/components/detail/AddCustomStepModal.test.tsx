import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AddCustomStepModal } from '../../../../../../src/features/team-management/components/detail/AddCustomStepModal';

const defaultProps = {
    open: true,
    title: '',
    description: '',
    expectedOutcome: '',
    estimatedMinutes: '30',
    tasks: [{ title: '', description: '' }],
    addingStep: false,
    errorMessage: '',
    onTitleChange: vi.fn(),
    onDescriptionChange: vi.fn(),
    onExpectedOutcomeChange: vi.fn(),
    onEstimatedMinutesChange: vi.fn(),
    onTasksChange: vi.fn(),
    onClose: vi.fn(),
    onSubmit: vi.fn(),
};

describe('AddCustomStepModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the modal with form fields when open', () => {
        render(<AddCustomStepModal {...defaultProps} />);

        expect(screen.getByText('Add Custom Step')).toBeInTheDocument();
        expect(screen.getByLabelText('Step title *')).toBeInTheDocument();
        expect(screen.getByLabelText('Description')).toBeInTheDocument();
        expect(screen.getByLabelText('Expected outcome')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
        render(<AddCustomStepModal {...defaultProps} open={false} />);
        expect(screen.queryByText('Add Custom Step')).not.toBeInTheDocument();
    });

    it('disables the Add step button when the title is empty', () => {
        render(<AddCustomStepModal {...defaultProps} title="" />);
        expect(screen.getByRole('button', { name: 'Add step' })).toBeDisabled();
    });

    it('enables the Add step button when the title is provided', () => {
        render(<AddCustomStepModal {...defaultProps} title="My Step" />);
        expect(screen.getByRole('button', { name: 'Add step' })).toBeEnabled();
    });

    it('calls onTitleChange when the title input is typed', async () => {
        const user = userEvent.setup();
        const onTitleChange = vi.fn();
        render(<AddCustomStepModal {...defaultProps} onTitleChange={onTitleChange} />);

        const titleInput = screen.getByLabelText('Step title *');
        await user.type(titleInput, 'A');

        expect(onTitleChange).toHaveBeenCalled();
    });

    it('renders the estimated minutes input', () => {
        render(<AddCustomStepModal {...defaultProps} estimatedMinutes="45" />);
        const minInput = screen.getByDisplayValue('45');
        expect(minInput).toHaveAttribute('type', 'number');
    });

    it('shows the Tasks section with an "Add task" button', () => {
        render(<AddCustomStepModal {...defaultProps} />);
        expect(screen.getByText('Tasks')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add task' })).toBeInTheDocument();
    });

    it('calls onTasksChange when "Add task" is clicked', async () => {
        const user = userEvent.setup();
        const onTasksChange = vi.fn();
        render(<AddCustomStepModal {...defaultProps} onTasksChange={onTasksChange} />);

        await user.click(screen.getByRole('button', { name: 'Add task' }));

        expect(onTasksChange).toHaveBeenCalled();
    });

    it('renders task row inputs', () => {
        render(
            <AddCustomStepModal
                {...defaultProps}
                tasks={[{ title: 'Task 1', description: 'Desc 1' }]}
            />,
        );

        expect(screen.getByDisplayValue('Task 1')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Desc 1')).toBeInTheDocument();
    });

    it('shows a remove button for task rows when there is more than one task', () => {
        render(
            <AddCustomStepModal
                {...defaultProps}
                tasks={[{ title: 'T1', description: '' }, { title: 'T2', description: '' }]}
            />,
        );

        expect(screen.getAllByRole('button', { name: /Remove task \d/ })).toHaveLength(2);
    });

    it('does not show a remove button when there is only one task', () => {
        render(
            <AddCustomStepModal
                {...defaultProps}
                tasks={[{ title: 'T1', description: '' }]}
            />,
        );

        expect(screen.queryByRole('button', { name: /Remove task \d/ })).not.toBeInTheDocument();
    });

    it('shows the error message when provided', () => {
        render(<AddCustomStepModal {...defaultProps} errorMessage="Something went wrong" />);
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('shows the "Adding..." label when addingStep is true', () => {
        render(<AddCustomStepModal {...defaultProps} title="Step" addingStep={true} />);
        expect(screen.getByRole('button', { name: /Adding\.\.\./ })).toBeInTheDocument();
    });

    it('calls onClose when the Cancel button is clicked', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<AddCustomStepModal {...defaultProps} onClose={onClose} />);

        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onClose).toHaveBeenCalled();
    });

    it('calls onSubmit when the Add step button is clicked', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        render(<AddCustomStepModal {...defaultProps} title="My Step" onSubmit={onSubmit} />);

        await user.click(screen.getByRole('button', { name: 'Add step' }));
        expect(onSubmit).toHaveBeenCalled();
    });
});
