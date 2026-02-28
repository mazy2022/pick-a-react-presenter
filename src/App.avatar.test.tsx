import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import App from './App';
import { PresentationStatus } from './types';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('App avatar upload', () => {
  const mockPresenters = [
    { name: 'John Doe', presentationStatus: PresentationStatus.NOT_SELECTED },
  ];

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ presenters: mockPresenters }),
    });

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn(() => 'blob:avatar-url'),
    });

    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: jest.fn(),
    });
  });

  it('allows selecting a custom avatar by clicking the presenter image', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const avatarButton = screen.getByRole('button', { name: 'Change avatar for John Doe' });
    await user.click(avatarButton);

    const avatarInput = document.querySelector('input.avatar-input') as HTMLInputElement;
    expect(avatarInput).toBeInTheDocument();

    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    fireEvent.change(avatarInput, { target: { files: [file] } });

    expect(URL.createObjectURL).toHaveBeenCalledWith(file);

    await waitFor(() => {
      const updatedAvatar = screen.getByAltText('John Doe avatar') as HTMLImageElement;
      expect(updatedAvatar.src).toContain('blob:avatar-url');
    });
  });
});
