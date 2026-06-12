import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileUploadZone } from '../../../../src/components/kb/FileUploadZone';

describe('FileUploadZone', () => {
  const mockOnUpload = vi.fn();

  beforeEach(() => {
    mockOnUpload.mockClear();
  });

  it('renders with correct labels', () => {
    render(<FileUploadZone onUpload={mockOnUpload} isUploading={false} />);
    expect(screen.getByText(/Drop multiple artifacts here/i)).toBeInTheDocument();
    expect(screen.getByText(/Drag & drop Markdown or Images/i)).toBeInTheDocument();
  });

  it('shows processing state when isUploading is true', () => {
    render(<FileUploadZone onUpload={mockOnUpload} isUploading={true} />);
    expect(screen.getByText(/Processing artifacts.../i)).toBeInTheDocument();
    expect(screen.getByText(/Ingesting your knowledge.../i)).toBeInTheDocument();
  });

  it('validates and calls onUpload for valid files', () => {
    render(<FileUploadZone onUpload={mockOnUpload} isUploading={false} />);
    
    // In JSDOM, we select the hidden file input
    const input = document.getElementById('fileInput') as HTMLInputElement;
    
    const file = new File(['hello'], 'test.md', { type: 'text/markdown' });
    fireEvent.change(input, { target: { files: [file] } });
    
    expect(mockOnUpload).toHaveBeenCalledWith([file]);
  });

  it('displays error for files that are too large', () => {
    render(<FileUploadZone onUpload={mockOnUpload} isUploading={false} />);
    const input = document.getElementById('fileInput') as HTMLInputElement;
    
    // Use a mock object that implements the File interface enough for our validator
    const largeFile = {
      name: 'large.pdf',
      size: 11 * 1024 * 1024,
      type: 'application/pdf',
      lastModified: Date.now(),
      webkitRelativePath: '',
    } as unknown as File;

    fireEvent.change(input, { target: { files: [largeFile] } });
    
    expect(screen.getByText(/File too large: large.pdf/i)).toBeInTheDocument();
    expect(mockOnUpload).not.toHaveBeenCalled();
  });

  it('displays error for unsupported file types', () => {
    render(<FileUploadZone onUpload={mockOnUpload} isUploading={false} />);
    const input = document.getElementById('fileInput') as HTMLInputElement;
    
    const badFile = {
      name: 'test.exe',
      size: 1024,
      type: 'application/x-msdownload',
      lastModified: Date.now(),
      webkitRelativePath: '',
    } as unknown as File;

    fireEvent.change(input, { target: { files: [badFile] } });
    
    expect(screen.getByText(/File type not supported: test.exe/i)).toBeInTheDocument();
    expect(mockOnUpload).not.toHaveBeenCalled();
  });

  it('handles drag and drop correctly', () => {
    render(<FileUploadZone onUpload={mockOnUpload} isUploading={false} />);
    const zone = screen.getByLabelText(/Upload documentation or images/i);
    
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
    
    fireEvent.drop(zone, {
      dataTransfer: {
        files: [file]
      }
    });
    
    expect(mockOnUpload).toHaveBeenCalledWith([file]);
  });

  it('has proper accessibility attributes', () => {
    render(<FileUploadZone onUpload={mockOnUpload} isUploading={false} />);
    const zone = screen.getByLabelText(/Upload documentation or images/i);
    
    expect(zone).toHaveAttribute('role', 'button');
    expect(zone).toHaveAttribute('tabIndex', '0');
  });

  it('disables interactions when isUploading is true', () => {
    render(<FileUploadZone onUpload={mockOnUpload} isUploading={true} />);
    const zone = screen.getByLabelText(/Upload documentation or images/i);
    
    expect(zone.className).toContain('pointer-events-none');
    expect(zone.className).toContain('opacity-50');
  });
});
