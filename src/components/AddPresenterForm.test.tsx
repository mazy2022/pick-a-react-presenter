import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import AddPresenterForm from './AddPresenterForm';

describe('AddPresenterForm Component', () => {
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();
  const existingNames = ['John Doe', 'Jane Smith'];

  beforeEach(() => {
    mockOnSubmit.mockClear();
    mockOnCancel.mockClear();
  });

  const defaultProps = {
    onSubmit: mockOnSubmit,
    onCancel: mockOnCancel,
    isLoading: false,
    existingNames,
  };

  it('renders form elements correctly', () => {
    render(<AddPresenterForm {...defaultProps} />);

    expect(screen.getByText('Add New Presenter')).toBeInTheDocument();
    expect(screen.getByLabelText('Name:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Presenter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('focuses the input field on mount', () => {
    render(<AddPresenterForm {...defaultProps} />);
    
    const nameInput = screen.getByLabelText('Name:');
    expect(nameInput).toHaveFocus();
  });

  it('updates input value when typing', async () => {
    const user = userEvent.setup();
    render(<AddPresenterForm {...defaultProps} />);

    const nameInput = screen.getByLabelText('Name:');
    await user.type(nameInput, 'New Person');

    expect(nameInput).toHaveValue('New Person');
  });

  it('shows validation error for empty name', async () => {
    const user = userEvent.setup();
    render(<AddPresenterForm {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: 'Add Presenter' });
    await user.click(submitButton);

    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('shows validation error for duplicate name', async () => {
    const user = userEvent.setup();
    render(<AddPresenterForm {...defaultProps} />);

    const nameInput = screen.getByLabelText('Name:');
    await user.type(nameInput, 'John Doe'); // Existing name

    const submitButton = screen.getByRole('button', { name: 'Add Presenter' });
    await user.click(submitButton);

    expect(screen.getByText('A presenter with this name already exists')).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('clears error when user starts typing', async () => {
    const user = userEvent.setup();
    render(<AddPresenterForm {...defaultProps} />);

    // First trigger an error
    const submitButton = screen.getByRole('button', { name: 'Add Presenter' });
    await user.click(submitButton);
    expect(screen.getByText('Name is required')).toBeInTheDocument();

    // Then start typing
    const nameInput = screen.getByLabelText('Name:');
    await user.type(nameInput, 'N');

    expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
  });

  it('submits form with valid name', async () => {
    const user = userEvent.setup();
    render(<AddPresenterForm {...defaultProps} />);

    const nameInput = screen.getByLabelText('Name:');
    await user.type(nameInput, 'New Person');

    const submitButton = screen.getByRole('button', { name: 'Add Presenter' });
    await user.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith('New Person');
  });

  it('trims whitespace from name before submission', async () => {
    const user = userEvent.setup();
    render(<AddPresenterForm {...defaultProps} />);

    const nameInput = screen.getByLabelText('Name:');
    await user.type(nameInput, '  New Person  ');

    const submitButton = screen.getByRole('button', { name: 'Add Presenter' });
    await user.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith('New Person');
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<AddPresenterForm {...defaultProps} />);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('calls onCancel when Escape key is pressed', async () => {
    const user = userEvent.setup();
    render(<AddPresenterForm {...defaultProps} />);

    const nameInput = screen.getByLabelText('Name:');
    await user.type(nameInput, '{Escape}');

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('disables form elements when loading', () => {
    render(<AddPresenterForm {...defaultProps} isLoading={true} />);

    const nameInput = screen.getByLabelText('Name:');
    const submitButton = screen.getByRole('button', { name: 'Adding...' });
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });

    expect(nameInput).toBeDisabled();
    expect(submitButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
  });

  it('shows loading text on submit button when loading', () => {
    render(<AddPresenterForm {...defaultProps} isLoading={true} />);

    expect(screen.getByRole('button', { name: 'Adding...' })).toBeInTheDocument();
  });

  it('disables submit button when name is empty', () => {
    render(<AddPresenterForm {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: 'Add Presenter' });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when valid name is entered', async () => {
    const user = userEvent.setup();
    render(<AddPresenterForm {...defaultProps} />);

    const nameInput = screen.getByLabelText('Name:');
    const submitButton = screen.getByRole('button', { name: 'Add Presenter' });

    expect(submitButton).toBeDisabled();

    await user.type(nameInput, 'Valid Name');
    expect(submitButton).not.toBeDisabled();
  });

  it('has proper accessibility attributes', () => {
    render(<AddPresenterForm {...defaultProps} />);

    const nameInput = screen.getByLabelText('Name:');
    expect(nameInput).toHaveAttribute('id', 'presenter-name');

    // Test error state accessibility
    fireEvent.click(screen.getByRole('button', { name: 'Add Presenter' }));
    
    const errorElement = screen.getByRole('alert');
    expect(errorElement).toHaveAttribute('id', 'name-error');
    expect(nameInput).toHaveAttribute('aria-describedby', 'name-error');
  });

  it('handles form submission via Enter key', async () => {
    const user = userEvent.setup();
    render(<AddPresenterForm {...defaultProps} />);

    const nameInput = screen.getByLabelText('Name:');
    await user.type(nameInput, 'New Person{Enter}');

    expect(mockOnSubmit).toHaveBeenCalledWith('New Person');
  });
});