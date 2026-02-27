import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import NotificationSystem from './NotificationSystem';
import { NotificationProps } from '../types';

describe('NotificationSystem Component', () => {
  const mockOnRemove = jest.fn();

  beforeEach(() => {
    mockOnRemove.mockClear();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const createNotification = (overrides: Partial<NotificationProps> = {}): NotificationProps => ({
    id: '1',
    type: 'success',
    message: 'Test notification',
    duration: 5000,
    ...overrides,
  });

  it('renders nothing when no notifications', () => {
    const { container } = render(
      <NotificationSystem notifications={[]} onRemove={mockOnRemove} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders notification with correct message', () => {
    const notification = createNotification({ message: 'Success message' });
    
    render(
      <NotificationSystem notifications={[notification]} onRemove={mockOnRemove} />
    );

    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  it('renders success notification with correct styling', () => {
    const notification = createNotification({ type: 'success' });
    
    render(
      <NotificationSystem notifications={[notification]} onRemove={mockOnRemove} />
    );

    const notificationElement = screen.getByRole('alert');
    expect(notificationElement).toHaveClass('notification-success');
  });

  it('renders error notification with correct styling', () => {
    const notification = createNotification({ type: 'error' });
    
    render(
      <NotificationSystem notifications={[notification]} onRemove={mockOnRemove} />
    );

    const notificationElement = screen.getByRole('alert');
    expect(notificationElement).toHaveClass('notification-error');
  });

  it('renders info notification with correct styling', () => {
    const notification = createNotification({ type: 'info' });
    
    render(
      <NotificationSystem notifications={[notification]} onRemove={mockOnRemove} />
    );

    const notificationElement = screen.getByRole('alert');
    expect(notificationElement).toHaveClass('notification-info');
  });

  it('renders multiple notifications', () => {
    const notifications = [
      createNotification({ id: '1', message: 'First notification' }),
      createNotification({ id: '2', message: 'Second notification' }),
    ];
    
    render(
      <NotificationSystem notifications={notifications} onRemove={mockOnRemove} />
    );

    expect(screen.getByText('First notification')).toBeInTheDocument();
    expect(screen.getByText('Second notification')).toBeInTheDocument();
  });

  it('calls onRemove when close button is clicked', async () => {
    const user = userEvent.setup();
    const notification = createNotification({ id: 'test-id' });
    
    render(
      <NotificationSystem notifications={[notification]} onRemove={mockOnRemove} />
    );

    const closeButton = screen.getByLabelText('Close notification');
    await user.click(closeButton);

    // Should call onRemove after animation delay
    await waitFor(() => {
      expect(mockOnRemove).toHaveBeenCalledWith('test-id');
    }, { timeout: 500 });
  });

  it('auto-dismisses notification after duration', async () => {
    jest.useFakeTimers();
    
    const notification = createNotification({ id: 'auto-dismiss', duration: 3000 });
    
    render(
      <NotificationSystem notifications={[notification]} onRemove={mockOnRemove} />
    );

    // Fast-forward time
    jest.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(mockOnRemove).toHaveBeenCalledWith('auto-dismiss');
    });
  });

  it('does not auto-dismiss when duration is 0', () => {
    jest.useFakeTimers();
    
    const notification = createNotification({ duration: 0 });
    
    render(
      <NotificationSystem notifications={[notification]} onRemove={mockOnRemove} />
    );

    jest.advanceTimersByTime(10000);
    expect(mockOnRemove).not.toHaveBeenCalled();
  });

  it('pauses auto-dismiss on mouse enter', () => {
    jest.useFakeTimers();
    
    const notification = createNotification({ duration: 3000 });
    
    render(
      <NotificationSystem notifications={[notification]} onRemove={mockOnRemove} />
    );

    const notificationElement = screen.getByRole('alert');
    
    // Advance time partially
    jest.advanceTimersByTime(1000);
    
    // Mouse enter should pause
    fireEvent.mouseEnter(notificationElement);
    
    // Advance remaining time
    jest.advanceTimersByTime(3000);
    
    // Should not have been removed
    expect(mockOnRemove).not.toHaveBeenCalled();
  });

  it('resumes auto-dismiss on mouse leave', async () => {
    jest.useFakeTimers();
    
    const notification = createNotification({ duration: 3000 });
    
    render(
      <NotificationSystem notifications={[notification]} onRemove={mockOnRemove} />
    );

    const notificationElement = screen.getByRole('alert');
    
    // Mouse enter to pause
    fireEvent.mouseEnter(notificationElement);
    jest.advanceTimersByTime(1000);
    
    // Mouse leave to resume
    fireEvent.mouseLeave(notificationElement);
    
    // Should auto-dismiss after full duration from resume
    jest.advanceTimersByTime(3000);
    
    await waitFor(() => {
      expect(mockOnRemove).toHaveBeenCalledWith('1');
    });
  });

  it('has proper accessibility attributes', () => {
    const notification = createNotification();
    
    render(
      <NotificationSystem notifications={[notification]} onRemove={mockOnRemove} />
    );

    const notificationElement = screen.getByRole('alert');
    expect(notificationElement).toHaveAttribute('aria-live', 'polite');

    const closeButton = screen.getByLabelText('Close notification');
    expect(closeButton).toBeInTheDocument();
  });

  it('shows visible class after mount animation', async () => {
    const notification = createNotification();
    
    render(
      <NotificationSystem notifications={[notification]} onRemove={mockOnRemove} />
    );

    const notificationElement = screen.getByRole('alert');
    
    // Initially should not have visible class
    expect(notificationElement).not.toHaveClass('visible');
    
    // After animation delay, should have visible class
    await waitFor(() => {
      expect(notificationElement).toHaveClass('visible');
    });
  });

  it('handles notification updates correctly', () => {
    const { rerender } = render(
      <NotificationSystem notifications={[]} onRemove={mockOnRemove} />
    );

    // Add notification
    const notification = createNotification();
    rerender(
      <NotificationSystem notifications={[notification]} onRemove={mockOnRemove} />
    );

    expect(screen.getByText('Test notification')).toBeInTheDocument();

    // Remove notification
    rerender(
      <NotificationSystem notifications={[]} onRemove={mockOnRemove} />
    );

    expect(screen.queryByText('Test notification')).not.toBeInTheDocument();
  });

  it('handles keyboard navigation for close button', async () => {
    const user = userEvent.setup();
    const notification = createNotification();
    
    render(
      <NotificationSystem notifications={[notification]} onRemove={mockOnRemove} />
    );

    const closeButton = screen.getByLabelText('Close notification');
    
    // Focus and activate with keyboard
    closeButton.focus();
    expect(closeButton).toHaveFocus();
    
    await user.keyboard('{Enter}');
    
    await waitFor(() => {
      expect(mockOnRemove).toHaveBeenCalled();
    });
  });
});