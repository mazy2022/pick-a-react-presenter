// Mock Azure Storage Blob
jest.mock('@azure/storage-blob');

const { BlobServiceClient } = require('@azure/storage-blob');
const addPresenterFunction = require('./index');

// Mock functions
const mockDownload = jest.fn();
const mockUpload = jest.fn();
const mockGetBlockBlobClient = jest.fn(() => ({
  download: mockDownload,
  upload: mockUpload
}));
const mockGetContainerClient = jest.fn(() => ({
  getBlockBlobClient: mockGetBlockBlobClient
}));

// Setup the mock
BlobServiceClient.fromConnectionString.mockReturnValue({
  getContainerClient: mockGetContainerClient
});

// Mock crypto for UUID generation
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-123')
}));

describe('AddPresenter Function', () => {
  let context;
  let mockReadableStream;

  beforeEach(() => {
    context = {
      res: {}
    };
    
    // Mock readable stream
    mockReadableStream = {
      on: jest.fn((event, callback) => {
        if (event === 'data') {
          callback('[]'); // Empty array as default
        } else if (event === 'end') {
          callback();
        }
      })
    };

    mockDownload.mockResolvedValue({
      readableStreamBody: mockReadableStream
    });
    mockUpload.mockResolvedValue({
      requestId: 'test-request-id'
    });

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Input Validation', () => {
    test('should return 400 when request body is missing', async () => {
      const req = {};
      
      await addPresenterFunction(context, req);
      
      expect(context.res.status).toBe(400);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('Request body is required');
    });

    test('should return 400 when name is missing', async () => {
      const req = { body: {} };
      
      await addPresenterFunction(context, req);
      
      expect(context.res.status).toBe(400);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('Presenter name is required and must be a string');
    });

    test('should return 400 when name is empty string', async () => {
      const req = { body: { name: '' } };
      
      await addPresenterFunction(context, req);
      
      expect(context.res.status).toBe(400);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('Presenter name is required and must be a string');
    });

    test('should return 400 when name is only whitespace', async () => {
      const req = { body: { name: '   ' } };
      
      await addPresenterFunction(context, req);
      
      expect(context.res.status).toBe(400);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('Presenter name cannot be empty');
    });

    test('should return 400 when name exceeds 100 characters', async () => {
      const longName = 'a'.repeat(101);
      const req = { body: { name: longName } };
      
      await addPresenterFunction(context, req);
      
      expect(context.res.status).toBe(400);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('Presenter name cannot exceed 100 characters');
    });

    test('should return 400 when name is not a string', async () => {
      const req = { body: { name: 123 } };
      
      await addPresenterFunction(context, req);
      
      expect(context.res.status).toBe(400);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('Presenter name is required and must be a string');
    });
  });

  describe('Avatar Validation', () => {
    test('should return 400 when avatar is not a valid data URL', async () => {
      const req = { body: { name: 'John Doe', avatar: 'not-an-image' } };

      await addPresenterFunction(context, req);

      expect(context.res.status).toBe(400);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('Avatar must be a valid image data URL');
    });
  });

  describe('Duplicate Name Validation', () => {
    test('should return 400 when presenter name already exists (case insensitive)', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 }
      ];
      
      mockReadableStream.on = jest.fn((event, callback) => {
        if (event === 'data') {
          callback(JSON.stringify(existingPresenters));
        } else if (event === 'end') {
          callback();
        }
      });

      const req = { body: { name: 'JOHN DOE' } };
      
      await addPresenterFunction(context, req);
      
      expect(context.res.status).toBe(400);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('A presenter with the name "JOHN DOE" already exists');
    });
  });

  describe('Successful Addition', () => {
    test('should successfully add presenter to empty list', async () => {
      const req = { body: { name: 'John Doe' } };
      
      await addPresenterFunction(context, req);
      
      expect(context.res.status).toBe(200);
      expect(context.res.body.success).toBe(true);
      expect(context.res.body.message).toBe('Presenter "John Doe" has been added successfully');
      expect(context.res.body.presenters).toHaveLength(1);
      expect(context.res.body.presenters[0]).toEqual({
        name: 'John Doe',
        presentationStatus: 0,
        id: 'test-uuid-123',
        addedDate: expect.any(String),
        avatar: undefined
      });
    });

    test('should successfully add presenter to existing list', async () => {
      const existingPresenters = [
        { name: 'Jane Smith', presentationStatus: 0 }
      ];
      
      mockReadableStream.on = jest.fn((event, callback) => {
        if (event === 'data') {
          callback(JSON.stringify(existingPresenters));
        } else if (event === 'end') {
          callback();
        }
      });

      const req = { body: { name: 'John Doe' } };
      
      await addPresenterFunction(context, req);
      
      expect(context.res.status).toBe(200);
      expect(context.res.body.success).toBe(true);
      expect(context.res.body.presenters).toHaveLength(2);
      expect(context.res.body.presenters[1].name).toBe('John Doe');
    });

    test('should trim whitespace from presenter name', async () => {
      const req = { body: { name: '  John Doe  ' } };
      
      await addPresenterFunction(context, req);
      
      expect(context.res.status).toBe(200);
      expect(context.res.body.presenters[0].name).toBe('John Doe');
    });


    test('should persist avatar when provided', async () => {
      const req = { body: { name: 'John Doe', avatar: 'data:image/png;base64,abc123' } };

      await addPresenterFunction(context, req);

      expect(context.res.status).toBe(200);
      expect(context.res.body.presenters[0].avatar).toBe('data:image/png;base64,abc123');
    });

    test('should call blob storage operations correctly', async () => {
      const req = { body: { name: 'John Doe' } };
      
      await addPresenterFunction(context, req);
      
      expect(mockGetContainerClient).toHaveBeenCalledWith('presenters');
      expect(mockGetBlockBlobClient).toHaveBeenCalledWith('presenters.json');
      expect(mockDownload).toHaveBeenCalledWith(0);
      expect(mockUpload).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number)
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle blob storage download error', async () => {
      mockDownload.mockRejectedValue(new Error('Storage error'));
      
      const req = { body: { name: 'John Doe' } };
      
      await addPresenterFunction(context, req);
      
      expect(context.res.status).toBe(500);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('An error occurred while adding the presenter');
      expect(context.res.body.error).toBe('Storage error');
    });

    test('should handle blob storage upload error', async () => {
      mockUpload.mockRejectedValue(new Error('Upload failed'));
      
      const req = { body: { name: 'John Doe' } };
      
      await addPresenterFunction(context, req);
      
      expect(context.res.status).toBe(500);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('An error occurred while adding the presenter');
    });

    test('should handle JSON parse error', async () => {
      mockReadableStream.on = jest.fn((event, callback) => {
        if (event === 'data') {
          callback('invalid json');
        } else if (event === 'end') {
          callback();
        }
      });

      const req = { body: { name: 'John Doe' } };
      
      await addPresenterFunction(context, req);
      
      expect(context.res.status).toBe(500);
      expect(context.res.body.success).toBe(false);
    });
  });
});