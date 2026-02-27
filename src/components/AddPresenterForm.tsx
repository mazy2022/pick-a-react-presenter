import React, { useState, useEffect, useRef } from 'react';
import { AddPresenterFormProps } from '../types';

const AddPresenterForm: React.FC<AddPresenterFormProps> = ({
  onSubmit,
  onCancel,
  isLoading,
  existingNames
}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the input when the form is mounted
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const validateName = (value: string): string | null => {
    if (!value.trim()) {
      return 'Name is required';
    }
    if (existingNames.includes(value.trim())) {
      return 'A presenter with this name already exists';
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const validationError = validateName(trimmedName);
    
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    onSubmit(trimmedName);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    
    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="add-presenter-form-overlay">
      <div className="add-presenter-form">
        <h3>Add New Presenter</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="presenter-name">Name:</label>
            <input
              ref={inputRef}
              id="presenter-name"
              type="text"
              value={name}
              onChange={handleNameChange}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="Enter presenter name"
              aria-describedby={error ? "name-error" : undefined}
            />
            {error && (
              <div id="name-error" className="error-text" role="alert">
                {error}
              </div>
            )}
          </div>
          
          <div className="form-actions">
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="submit-button"
            >
              {isLoading ? 'Adding...' : 'Add Presenter'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="cancel-button"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPresenterForm;