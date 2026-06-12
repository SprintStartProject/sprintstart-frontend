import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { FileUploadZone } from '../../../../src/components/kb/FileUploadZone';

describe('FileUploadZone', () => {
  it('renders with correct accessibility attributes', () => {
    render(<FileUploadZone onUpload={vi.fn()} isUploading={false} />);
    
    const zone = screen.getByRole('button', { name: /upload documentation or images/i });
    expect(zone).toHaveAttribute('tabIndex', '0');
  });

  it('triggers file input when clicked', async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    const { container } = render(<FileUploadZone onUpload={onUpload} isUploading={false} />);
    
    const input = container.querySelector('#fileInput') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');

    const zone = screen.getByRole('button');
    await user.click(zone);
    
    expect(clickSpy).toHaveBeenCalled();
  });

  it('triggers file input on Enter or Space key', () => {
    const { container } = render(<FileUploadZone onUpload={vi.fn()} isUploading={false} />);
    
    const input = container.querySelector('#fileInput') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');

    const zone = screen.getByRole('button');
    
    fireEvent.keyDown(zone, { key: 'Enter' });
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockClear();
    
    fireEvent.keyDown(zone, { key: ' ' });
    expect(clickSpy).toHaveBeenCalled();
  });

  it('shows error message for unsupported file types', async () => {
    const { container } = render(<FileUploadZone onUpload={vi.fn()} isUploading={false} />);
    
    const input = container.querySelector('#fileInput') as HTMLInputElement;
    const file = new File(['content'], 'test.exe', { type: 'application/x-msdownload' });
    
    fireEvent.change(input, { target: { files: [file] } });
    
    expect(await screen.findByText(/file type not supported/i)).toBeInTheDocument();
  });

  it('calls onUpload when valid files are selected', async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    const { container } = render(<FileUploadZone onUpload={onUpload} isUploading={false} />);
    
    const input = container.querySelector('#fileInput') as HTMLInputElement;
    const file = new File(['content'], 'test.md', { type: 'text/markdown' });
    
    await user.upload(input, file);
    
    expect(onUpload).toHaveBeenCalledWith([file]);
  });

  it('shows loading state when isUploading is true', () => {
    render(<FileUploadZone onUpload={vi.fn()} isUploading={true} />);
    
    expect(screen.getByText(/processing artifacts/i)).toBeInTheDocument();
    const zone = screen.getByRole('button');
    expect(zone).toHaveClass('pointer-events-none');
  });
});
