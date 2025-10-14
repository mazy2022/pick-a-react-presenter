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
  { name: 'Alice Johnson', presentationStatus: PresentationStatus.NOT_SELECTED },
  { name: 'Bob Smith', presentationStatus: PresentationStatus.NOT_SELECTED },
  { name: 'Carol Davis', presentationStatus: PresentationStatus.PRESENTED },
];

describe('Integration Tests - Complete User Workflows', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    // Mock window.confirm for all tests
    window.confirm = jest.fn(() => true);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Add Presenter Workflow', () => {
    it('completes full add presenter workflow successfully', async () => {
      const user = userEvent.setup();

      // Initial load
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ presenters: mockPresenters }),
      });

      // Add presenter response
      const newPresenters = [
        ...mockPresenters,
        { name: 'David Wilson', presentationStatus: PresentationStatus.NOT_SELECTED },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ presenters: newPresenters }),
      });

      render(<App />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });

      // Step 1: Click Add Presenter button
      const addButton = screen.getByRole('button', { name: 'Add Presenter' });
      await user.click(addButton);

      // Step 2: Verify form opens
      expect(screen.getByText('Add New Presenter')).toBeInTheDocument();
      expect(screen.getByLabelText('Name:')).toBeInTheDocument();

      // Step 3: Fill in the form
      const nameInput = screen.getByLabelText('Name:');
      await user.type(nameInput, 'David Wilson');

      // Step 4: Submit the form
      const submitButton = screen.getByRole('button', { name: 'Add Presenter' });
      await user.click(submitButton);

      // Step 5: Verify API call
      expect(mockFetch).toHaveBeenCalledWith('api/AddPresenter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'David Wilson' }),
      });

      // Step 6: Verify success notification
      await waitFor(() => {
        expect(screen.getByText('David Wilson added successfully!')).toBeInTheDocument();
      });

      // Step 7: Verify form closes and new presenter appears
      expect(screen.queryByText('Add New Presenter')).not.toBeInTheDocument();
      expect(screen.getByText('David Wilson')).toBeInTheDocument();
    });

    it('handles add presenter validation errors', async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ presenters: mockPresenters }),
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });

      // Open form
      const addButton = screen.getByRole('button', { name: 'Add Presenter' });
      await user.click(addButton);

      // Try to submit empty form
      const submitButton = screen.getByRole('button', { name: 'Add Presenter' });
      await user.click(submitButton);

      // Should show validation error
      expect(screen.getByText('Name is required')).toBeInTheDocument();
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only initial load

      // Try duplicate name
      const nameInput = screen.getByLabelText('Name:');
      await user.clear(nameInput);
      await user.type(nameInput, 'Alice Johnson');
      await user.click(submitButton);

      expect(screen.getByText('A presenter with this name already exists')).toBeInTheDocument();
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still only initial load
    });

    it('handles add presenter API errors', async () => {
      const user = userEvent.setup();

      // Initial load
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ presenters: mockPresenters }),
      });

      // Add presenter error response
      mockFetch.mockRejectedValueOnce(new Error('Server error'));

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });

      // Open form and submit
      const addButton = screen.getByRole('button', { name: 'Add Presenter' });
      await user.click(addButton);

      const nameInput = screen.getByLabelText('Name:');
      await user.type(nameInput, 'New Person');

      const submitButton = screen.getByRole('button', { name: 'Add Presenter' });
      await user.click(submitButton);

      // Should show error notification
      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });

      // Form should still be open
      expect(screen.getByText('Add New Presenter')).toBeInTheDocument();
    });
  });

  describe('Remove Presenter Workflow', () => {
    it('completes full remove presenter workflow successfully', async () => {
      const user = userEvent.setup();

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
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });

      // Step 1: Click remove button
      const removeButtons = screen.getAllByTitle(/Remove/);
      await user.click(removeButtons[0]); // Remove Alice Johnson

      // Step 2: Verify confirmation dialog
      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to remove Alice Johnson?');

      // Step 3: Verify API call
      expect(mockFetch).toHaveBeenCalledWith('api/RemovePresenter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Alice Johnson' }),
      });

      // Step 4: Verify success notification
      await waitFor(() => {
        expect(screen.getByText('Alice Johnson removed successfully!')).toBeInTheDocument();
      });

      // Step 5: Verify presenter is removed from list
      expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();
      expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    });

    it('cancels remove when user declines confirmation', async () => {
      const user = userEvent.setup();
      window.confirm = jest.fn(() => false); // User cancels

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ presenters: mockPresenters }),
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });

      const removeButtons = screen.getAllByTitle(/Remove/);
      await user.click(removeButtons[0]);

      expect(window.confirm).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only initial load
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument(); // Still there
    });
  });

  describe('Presenter Selection Workflow', () => {
    it('completes presenter selection with debouncing', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ delay: null });

      // Initial load
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ presenters: mockPresenters }),
      });

      // Selection response
      const updatedPresenters = [
        { name: 'Alice Johnson', presentationStatus: PresentationStatus.ASSIGNED },
        { name: 'Bob Smith', presentationStatus: PresentationStatus.NOT_SELECTED },
        { name: 'Carol Davis', presentationStatus: PresentationStatus.PRESENTED },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ presenters: updatedPresenters }),
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });

      // Step 1: Click select button
      const pickButton = screen.getByRole('button', { name: /pick a new/i });
      await user.click(pickButton);

      // Step 2: Verify button is disabled and shows loading state
      expect(pickButton).toBeDisabled();
      expect(screen.getByText('Selecting...')).toBeInTheDocument();

      // Step 3: Verify API call
      expect(mockFetch).toHaveBeenCalledWith('api/SelectNextPresenter');

      // Step 4: Wait for success notification
      await waitFor(() => {
        expect(screen.getByText('Presenter selected successfully!')).toBeInTheDocument();
      });

      // Step 5: Verify debouncing - button should still be disabled
      expect(pickButton).toBeDisabled();

      // Step 6: Fast-forward time to end debounce period
      jest.advanceTimersByTime(2000);

      // Step 7: Button should be enabled again
      await waitFor(() => {
        expect(pickButton).not.toBeDisabled();
      });
    });
  });

  describe('Reset Presenters Workflow', () => {
    it('completes reset workflow successfully', async () => {
      const user = userEvent.setup();

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
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });

      // Step 1: Click reset button
      const resetButton = screen.getByRole('button', { name: 'Reset All' });
      await user.click(resetButton);

      // Step 2: Verify confirmation
      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to reset all presenters?');

      // Step 3: Verify API call
      expect(mockFetch).toHaveBeenCalledWith('api/ResetPresenters', {
        method: 'POST',
      });

      // Step 4: Verify success notification
      await waitFor(() => {
        expect(screen.getByText('All presenters reset successfully!')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling Workflows', () => {
    it('handles network errors gracefully across all operations', async () => {
      const user = userEvent.setup();

      // Initial load succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ presenters: mockPresenters }),
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });

      // Test selection error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const pickButton = screen.getByRole('button', { name: /pick a new/i });
      await user.click(pickButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to select presenter')).toBeInTheDocument();
      });

      // Test reset error
      mockFetch.mockRejectedValueOnce(new Error('Reset failed'));
      const resetButton = screen.getByRole('button', { name: 'Reset All' });
      await user.click(resetButton);

      await waitFor(() => {
        expect(screen.getByText('Reset failed')).toBeInTheDocument();
      });
    });

    it('recovers from initial load failure', async () => {
      // Initial load fails
      mockFetch.mockRejectedValueOnce(new Error('Load failed'));

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load presenters')).toBeInTheDocument();
      });

      // Verify error notification appears
      expect(screen.getByText('Failed to load presenters')).toBeInTheDocument();
    });
  });

  describe('Notification System Integration', () => {
    it('shows and dismisses notifications correctly', async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ presenters: mockPresenters }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ presenters: [...mockPresenters, { name: 'New Person', presentationStatus: PresentationStatus.NOT_SELECTED }] }),
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      });

      // Trigger an action that shows notification
      const addButton = screen.getByRole('button', { name: 'Add Presenter' });
      await user.click(addButton);

      const nameInput = screen.getByLabelText('Name:');
      await user.type(nameInput, 'New Person');

      const submitButton = screen.getByRole('button', { name: 'Add Presenter' });
      await user.click(submitButton);

      // Wait for notification
      await waitFor(() => {
        expect(screen.getByText('New Person added successfully!')).toBeInTheDocument();
      });

      // Manually dismiss notification
      const closeButton = screen.getByLabelText('Close notification');
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('New Person added successfully!')).not.toBeInTheDocument();
      });
    });
  });
});