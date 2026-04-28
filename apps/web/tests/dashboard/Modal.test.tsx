import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Modal } from '../../components/dashboard/Modal';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('Modal', () => {
  it('does not render when closed', () => {
    render(<Modal open={false} onClose={() => {}} title="Hello"><div>body</div></Modal>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title, body, and close button when open', () => {
    render(
      <Modal open onClose={() => {}} title="Hello">
        <div>body content</div>
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hello' })).toBeInTheDocument();
    expect(screen.getByText('body content')).toBeInTheDocument();
    expect(screen.getByLabelText(/close/i)).toBeInTheDocument();
  });

  it('renders the footer when provided', () => {
    render(
      <Modal open onClose={() => {}} title="t" footer={<button>Save</button>}>
        body
      </Modal>,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="t">body</Modal>);
    fireEvent.click(screen.getByLabelText(/close/i));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="t">body</Modal>);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose when clicking inside the dialog', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="t">body</Modal>);
    fireEvent.click(screen.getByText('body'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="t">body</Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('locks body scroll while open', () => {
    render(<Modal open onClose={() => {}} title="t">body</Modal>);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body scroll on unmount', () => {
    const { unmount } = render(<Modal open onClose={() => {}} title="t">body</Modal>);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('exposes aria-modal=true and the title via aria-label', () => {
    render(<Modal open onClose={() => {}} title="My Dialog">body</Modal>);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'My Dialog');
  });
});
