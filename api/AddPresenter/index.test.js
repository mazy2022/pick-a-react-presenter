const addPresenterFunction = require('./index');

// Mock Azure Storage Blob
jest.mock('@azure/storage-blob');
const { BlobServiceClient } = require('@azure/storage-blob');

// Mock crypto for UUID generation
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-123')
}));

describe('AddPresenter Azure Function', () => {
  let mockContext;
  let mockBlobServiceClient;
  let mockContainerClient;
  let mockBlockBlobClient;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock context
    mockContext = {
      res: {}
    };

    // Mock blob storage clients
    mockBlockBlobClient = {
      download: jest.fn(),
      upload: jest.fn()
    };

    mockContainerClient = {
      getBlockBlobClient: jest.fn(() => mockBlockBlobClient)
    };

    mockBlobServiceClient = {
      getContainerClient: jest.fn(() => mockContainerClient)
    };

    BlobServiceClient.fromConnectionString = jest.fn(() => mockBlobServiceClient);

    // Mock Date
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2023-01-01T00:00:00.000Z');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Validation Tests', () => {
    test('should return 400 when request body is missing', async () => {
      const req = {};

      await addPresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(400);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('Request body is required');
    });

    test('should return 400 when name is missing', async () => {
      const req = { body: {} };

      await addPresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(400);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('Presenter name is required and must be a string');
    });

    test('should return 400 when name is empty string', async () => {
      const req = { body: { name: '   ' } };

      await addPresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(400);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('Presenter name cannot be empty');
    });

    test('should return 400 when name is not a string', async () => {
      const req = { body: { name: 123 } };

      await addPresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(400);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('Presenter name is required and must be a string');
    });

    test('should return 400 when name exceeds 100 characters', async () => {
      const longName = 'a'.repeat(101);
      const req = { body: { name: longName } };

      await addPresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(400);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('Presenter name cannot exceed 100 characters');
    });
  });

  describe('Duplicate Name Tests', () => {
    test('should return 400 when presenter name already exists', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 },
        { name: 'Jane Smith', presentationStatus: 0 }
      ];

      // Mock blob storage response
      const mockReadableStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify(existingPresenters));
          } else if (event === 'end') {
            callback();
          }
        })
      };

      mockBlockBlobClient.download.mockResolvedValue({
        readableStreamBody: mockReadableStream
      });

      const req = { body: { name: 'John Doe' } };

      await addPresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(400);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('A presenter with the name "John Doe" already exists');
    });

    test('should be case insensitive when checking duplicates', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 }
      ];

      // Mock blob storage response
      const mockReadableStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify(existingPresenters));
          } else if (event === 'end') {
            callback();
          }
        })
      };

      mockBlockBlobClient.download.mockResolvedValue({
        readableStreamBody: mockReadableStream
      });

      const req = { body: { name: 'JOHN DOE' } };

      await addPresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(400);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('A presenter with the name "JOHN DOE" already exists');
    });
  });

  describe('Successful Addition Tests', () => {
    test('should successfully add a new presenter', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 }
      ];

      // Mock blob storage response
      const mockReadableStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify(existingPresenters));
          } else if (event === 'end') {
            callback();
          }
        })
      };

      mockBlockBlobClient.download.mockResolvedValue({
        readableStreamBody: mockReadableStream
      });

      mockBlockBlobClient.upload.mockResolvedValue({
        requestId: 'test-request-id'
      });

      const req = { body: { name: 'Jane Smith' } };

      await addPresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(200);
      expect(mockContext.res.body.success).toBe(true);
      expect(mockContext.res.body.message).toBe('Presenter "Jane Smith" has been added successfully');
      expect(mockContext.res.body.presenters).toHaveLength(2);
      
      const newPresenter = mockContext.res.body.presenters.find(p => p.name === 'Jane Smith');
      expect(newPresenter).toBeDefined();
      expect(newPresenter.presentationStatus).toBe(0);
      expect(newPresenter.id).toBe('test-uuid-123');
      expect(newPresenter.addedDate).toBe('2023-01-01T00:00:00.000Z');
    });

    test('should trim whitespace from presenter name', async () => {
      const existingPresenters = [];

      // Mock blob storage response
      const mockReadableStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify(existingPresenters));
          } else if (event === 'end') {
            callback();
          }
        })
      };

      mockBlockBlobClient.download.mockResolvedValue({
        readableStreamBody: mockReadableStream
      });

      mockBlockBlobClient.upload.mockResolvedValue({
        requestId: 'test-request-id'
      });

      const req = { body: { name: '  Jane Smith  ' } };

      await addPresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(200);
      expect(mockContext.res.body.success).toBe(true);
      expect(mockContext.res.body.presenters[0].name).toBe('Jane Smith');
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle blob storage read errors', async () => {
      mockBlockBlobClient.download.mockRejectedValue(new Error('Blob storage error'));

      const req = { body: { name: 'Jane Smith' } };

      await addPresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(500);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('An error occurred while adding the presenter');
      expect(mockContext.res.body.error).toBe('Blob storage error');
    });

    test('should handle blob storage upload errors', async () => {
      const existingPresenters = [];

      // Mock blob storage response
      const mockReadableStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify(existingPresenters));
          } else if (event === 'end') {
            callback();
          }
        })
      };

      mockBlockBlobClient.download.mockResolvedValue({
        readableStreamBody: mockReadableStream
      });

      mockBlockBlobClient.upload.mockRejectedValue(new Error('Upload failed'));

      const req = { body: { name: 'Jane Smith' } };

      await addPresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(500);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('An error occurred while adding the presenter');
      expect(mockContext.res.body.error).toBe('Upload failed');
    });
  });
});