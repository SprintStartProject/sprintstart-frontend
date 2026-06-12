import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, type Mock } from 'vitest';
import { ThemeToggle } from '../../../../src/components/common/ThemeToggle';
import { useTheme } from '../../../../src/context/useTheme';

// Mock the useTheme hook
vi.mock('../../../../src/context/useTheme', () => ({
  useTheme: vi.fn(),
}));

describe('ThemeToggle', () => {
  it('renders correctly in light mode', () => {
    (useTheme as Mock).mockReturnValue({
      isDarkMode: false,
      toggleTheme: vi.fn(),
    });

    render(<ThemeToggle />);
    
    expect(screen.getByText('Light Mode')).toBeInTheDocument();
    expect(screen.getByLabelText('Toggle light and dark mode')).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders correctly in dark mode', () => {
    (useTheme as Mock).mockReturnValue({
      isDarkMode: true,
      toggleTheme: vi.fn(),
    });

    render(<ThemeToggle />);
    
    expect(screen.getByText('Dark Mode')).toBeInTheDocument();
    expect(screen.getByLabelText('Toggle light and dark mode')).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls toggleTheme when clicked', () => {
    const toggleTheme = vi.fn();
    (useTheme as Mock).mockReturnValue({
      isDarkMode: false,
      toggleTheme,
    });

    render(<ThemeToggle />);
    
    const button = screen.getByLabelText('Toggle light and dark mode');
    fireEvent.click(button);
    
    expect(toggleTheme).toHaveBeenCalledTimes(1);
  });

  it('does not show label when showLabel is false', () => {
    (useTheme as Mock).mockReturnValue({
      isDarkMode: false,
      toggleTheme: vi.fn(),
    });

    render(<ThemeToggle showLabel={false} />);
    
    expect(screen.queryByText('Light Mode')).not.toBeInTheDocument();
  });
});
