import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import App from './App';
import { PresentationStatus } from './types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockPresenters = [
  { name: 'John Doe', presentationStatus: PresentationStatus.NOT_SELECTED },
  { name: 'Jane Smith', presentationStatus: PresentationStatus.ASSIGNED },
  { name: 'Bob Johnson', presentationStatus: PresentationStatus.PRESENTED },
];

describe('App Component', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('renders the main heading', () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ presenters: mockPresenters }),
    });

    render(<App />);
    expect(screen.getByText('Pick a Presenter')).toBeInTheDocument();
  });

  it('loads presenters on mount', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ presenters: mockPresenters }),
    });

    render(<App />);

    expect(mockFetch).toHaveBeenCalledWith('api/GetPresenters');
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<App />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('handles API error on load', async () => {
    mockFetch.mockRejectedValueOnce(new Error('API Error'));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load presenters')).toBeInTheDocument();
    });
  });

  it('selects a presenter when pick button is clicked', async () => {
    const user = userEvent.setup();
    
    // Initial load
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ presenters: mockPresenters }),
    });

    // Select presenter response
    const updatedPresenters = [
      { name: 'John Doe', presentationStatus: PresentationStatus.ASSIGNED },
      { name: 'Jane Smith', presentationStatus: PresentationStatus.PRESENTED },
      { name: 'Bob Johnson', presentationStatus: PresentationStatus.PRESENTED },
    ];
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ presenters: updatedPresenters }),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const pickButton = screen.getByRole('button', { name: /pick a new/i });
    await user.click(pickButton);

    expect(mockFetch).toHaveBeenCalledWith('api/SelectNextPresenter');
    
    await waitFor(() => {
      expect(screen.getByText('Presenter selected successfully!')).toBeInTheDocument();
    });
  });

  it('implements debouncing for presenter selection', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ delay: null });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ presenters: mockPresenters }),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const pickButton = screen.getByRole('button', { name: /pick a new/i });
    
    // Click the button
    await user.click(pickButton);
    
    // Button should be disabled and show "Selecting..."
    expect(pickButton).toBeDisabled();
    expect(screen.getByText('Selecting...')).toBeInTheDocument();

    // Fast-forward time by 2 seconds
    jest.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(pickButton).not.toBeDisabled();
    });

    jest.useRealTimers();
  });

  it('opens add presenter form when add button is clicked', async () => {
    const user = userEvent.setup();
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ presenters: mockPresenters }),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const addButton = screen.getByRole('button', { name: 'Add Presenter' });
    await user.click(addButton);

    expect(screen.getByText('Add New Presenter')).toBeInTheDocument();
    expect(screen.getByLabelText('Name:')).toBeInTheDocument();
  });

  it('adds a new presenter successfully', async () => {
    const user = userEvent.setup();
    
    // Initial load
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ presenters: mockPresenters }),
    });

    // Add presenter response
    const newPresenters = [
      ...mockPresenters,
      { name: 'New Person', presentationStatus: PresentationStatus.NOT_SELECTED },
    ];
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ presenters: newPresenters }),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Open form
    const addButton = screen.getByRole('button', { name: 'Add Presenter' });
    await user.click(addButton);

    // Fill form
    const nameInput = screen.getByLabelText('Name:');
    await user.type(nameInput, 'New Person');

    // Submit form
    const submitButton = screen.getByRole('button', { name: 'Add Presenter' });
    await user.click(submitButton);

    expect(mockFetch).toHaveBeenCalledWith('api/AddPresenter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Person' }),
    });

    await waitFor(() => {
      expect(screen.getByText('New Person added successfully!')).toBeInTheDocument();
    });
  });

  it('removes a presenter with confirmation', async () => {
    const user = userEvent.setup();
    
    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => true);

    // Initial load
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ presenters: mockPresenters }),
    });

    // Remove presenter response
    const remainingPresenters = mockPresenters.slice(1);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ presenters: remainingPresenters }),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Find and click remove button for John Doe
    const removeButtons = screen.getAllByTitle(/Remove/);
    await user.click(removeButtons[0]);

    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to remove John Doe?');
    expect(mockFetch).toHaveBeenCalledWith('api/RemovePresenter', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'John Doe' }),
    });

    await waitFor(() => {
      expect(screen.getByText('John Doe removed successfully!')).toBeInTheDocument();
    });

    // Restore original confirm
    window.confirm = originalConfirm;
  });

  it('resets all presenters with confirmation', async () => {
    const user = userEvent.setup();
    
    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => true);

    // Initial load
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ presenters: mockPresenters }),
    });

    // Reset response
    const resetPresenters = mockPresenters.map(p => ({
      ...p,
      presentationStatus: PresentationStatus.NOT_SELECTED,
    }));
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ presenters: resetPresenters }),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const resetButton = screen.getByRole('button', { name: 'Reset All' });
    await user.click(resetButton);

    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to reset all presenters?');
    expect(mockFetch).toHaveBeenCalledWith('api/ResetPresenters', {
      method: 'POST',
    });

    await waitFor(() => {
      expect(screen.getByText('All presenters reset successfully!')).toBeInTheDocument();
    });

    // Restore original confirm
    window.confirm = originalConfirm;
  });

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup();
    
    // Initial load
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ presenters: mockPresenters }),
    });

    // Error response for selection
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const pickButton = screen.getByRole('button', { name: /pick a new/i });
    await user.click(pickButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to select presenter')).toBeInTheDocument();
    });
  });
});