import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeProvider } from '../../../src/context/ThemeProvider';
import { useTheme } from '../../../src/context/useTheme';

// Helper component to consume the hook
const TestComponent = () => {
  const { theme, toggleTheme, isDarkMode } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="isDarkMode">{isDarkMode.toString()}</span>
      <button onClick={toggleTheme} data-testid="toggle">Toggle</button>
    </div>
  );
};

describe('ThemeProvider & useTheme', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('provides the default theme (light)', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(getByTestId('theme')).toHaveTextContent('light');
    expect(getByTestId('isDarkMode')).toHaveTextContent('false');
  });

  it('toggles the theme when toggleTheme is called', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const toggleButton = getByTestId('toggle');

    act(() => {
      toggleButton.click();
    });

    expect(getByTestId('theme')).toHaveTextContent('dark');
    expect(getByTestId('isDarkMode')).toHaveTextContent('true');
    expect(window.localStorage.getItem('theme')).toBe('dark');
  });

  it('initializes from localStorage if available', () => {
    window.localStorage.setItem('theme', 'dark');

    const { getByTestId } = render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(getByTestId('theme')).toHaveTextContent('dark');
  });

  it('initializes from system preference if no localStorage', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: dark)',
      })),
    });

    const { getByTestId } = render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(getByTestId('theme')).toHaveTextContent('dark');
  });
});
