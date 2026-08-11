import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FileUploadZone } from "../../../../../src/features/knowledge-base/components/FileUploadZone";

describe("FileUploadZone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeFile(name: string, type: string, size = 1024): File {
    const blob = new Blob(["dummy"], { type });
    const file = new File([blob], name, { type });
    // Override size after construction — the Blob content is tiny but the
    // validation logic reads `file.size`, not the actual content.
    Object.defineProperty(file, "size", { value: size, configurable: true });
    return file;
  }

  it("calls onUpload with valid files when dropped via input change", () => {
    const onUpload = vi.fn();
    render(<FileUploadZone onUpload={onUpload} isUploading={false} />);

    const input = screen.getByTestId("file-input");
    const file = makeFile("doc.md", "text/markdown");

    fireEvent.change(input, { target: { files: [file] } });

    expect(onUpload).toHaveBeenCalledWith([file]);
  });

  it("shows an error for unsupported file types and does not upload them", () => {
    const onUpload = vi.fn();
    render(<FileUploadZone onUpload={onUpload} isUploading={false} />);

    const input = screen.getByTestId("file-input");
    const badFile = makeFile("script.exe", "application/octet-stream");

    fireEvent.change(input, { target: { files: [badFile] } });

    expect(onUpload).not.toHaveBeenCalled();
    expect(screen.getByTestId("file-upload-errors")).toBeInTheDocument();
    expect(screen.getByText(/File type not supported/)).toBeInTheDocument();
  });

  it("surfaces all validation errors, not just the first", () => {
    const onUpload = vi.fn();
    render(<FileUploadZone onUpload={onUpload} isUploading={false} />);

    const input = screen.getByTestId("file-input");
    const bad1 = makeFile("a.exe", "application/octet-stream");
    const bad2 = makeFile("b.exe", "application/octet-stream");

    fireEvent.change(input, { target: { files: [bad1, bad2] } });

    expect(onUpload).not.toHaveBeenCalled();
    const errorRegion = screen.getByTestId("file-upload-errors");
    expect(errorRegion.querySelectorAll("li")).toHaveLength(2);
  });

  it("shows an error for files exceeding the 10MB limit", () => {
    const onUpload = vi.fn();
    render(<FileUploadZone onUpload={onUpload} isUploading={false} />);

    const input = screen.getByTestId("file-input");
    const bigFile = makeFile("huge.pdf", "application/pdf", 11 * 1024 * 1024);

    fireEvent.change(input, { target: { files: [bigFile] } });

    expect(onUpload).not.toHaveBeenCalled();
    expect(screen.getByText(/File too large/)).toBeInTheDocument();
  });

  it("accepts .md files even when the browser reports an empty MIME type", () => {
    const onUpload = vi.fn();
    render(<FileUploadZone onUpload={onUpload} isUploading={false} />);

    const input = screen.getByTestId("file-input");
    const mdFile = makeFile("readme.md", "");

    fireEvent.change(input, { target: { files: [mdFile] } });

    expect(onUpload).toHaveBeenCalledWith([mdFile]);
    expect(screen.queryByTestId("file-upload-errors")).not.toBeInTheDocument();
  });

  it("disables interaction when isUploading is true", () => {
    const onUpload = vi.fn();
    render(<FileUploadZone onUpload={onUpload} isUploading={true} />);

    const dropZone = screen.getByRole("button", { name: "Upload documentation or images" });
    expect(dropZone.className).toContain("pointer-events-none");
    expect(dropZone.className).toContain("opacity-50");
  });
});
