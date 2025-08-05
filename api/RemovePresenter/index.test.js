const removePresenterFunction = require('./index');

// Mock Azure Storage Blob
jest.mock('@azure/storage-blob');
const { BlobServiceClient } = require('@azure/storage-blob');

describe('RemovePresenter Azure Function', () => {
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
  });

  describe('Validation Tests', () => {
    test('should return 400 when request body is missing', async () => {
      const req = {};

      await removePresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(400);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('Request body is required');
    });

    test('should return 400 when name is missing', async () => {
      const req = { body: {} };

      await removePresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(400);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('Presenter name is required and must be a string');
    });

    test('should return 400 when name is empty string', async () => {
      const req = { body: { name: '   ' } };

      await removePresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(400);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('Presenter name cannot be empty');
    });

    test('should return 400 when name is not a string', async () => {
      const req = { body: { name: 123 } };

      await removePresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(400);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('Presenter name is required and must be a string');
    });
  });

  describe('Presenter Not Found Tests', () => {
    test('should return 404 when presenter does not exist', async () => {
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

      const req = { body: { name: 'Non Existent' } };

      await removePresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(404);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('Presenter "Non Existent" not found');
    });

    test('should be case insensitive when finding presenter', async () => {
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

      mockBlockBlobClient.upload.mockResolvedValue({
        requestId: 'test-request-id'
      });

      const req = { body: { name: 'JOHN DOE' } };

      await removePresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(200);
      expect(mockContext.res.body.success).toBe(true);
      expect(mockContext.res.body.presenters).toHaveLength(1);
      expect(mockContext.res.body.presenters[0].name).toBe('Jane Smith');
    });
  });

  describe('Last Presenter Protection Tests', () => {
    test('should return 400 when trying to remove the last presenter', async () => {
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

      const req = { body: { name: 'John Doe' } };

      await removePresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(400);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('Cannot remove the last presenter. At least one presenter must remain in the list.');
      expect(mockContext.res.body.error).toBe('Cannot remove last presenter');
    });
  });

  describe('Successful Removal Tests', () => {
    test('should successfully remove a presenter', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 },
        { name: 'Jane Smith', presentationStatus: 10 },
        { name: 'Bob Johnson', presentationStatus: 20 }
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

      await removePresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(200);
      expect(mockContext.res.body.success).toBe(true);
      expect(mockContext.res.body.message).toBe('Presenter "Jane Smith" has been removed successfully');
      expect(mockContext.res.body.presenters).toHaveLength(2);
      
      const remainingNames = mockContext.res.body.presenters.map(p => p.name);
      expect(remainingNames).toContain('John Doe');
      expect(remainingNames).toContain('Bob Johnson');
      expect(remainingNames).not.toContain('Jane Smith');
    });

    test('should trim whitespace from presenter name when searching', async () => {
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

      mockBlockBlobClient.upload.mockResolvedValue({
        requestId: 'test-request-id'
      });

      const req = { body: { name: '  John Doe  ' } };

      await removePresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(200);
      expect(mockContext.res.body.success).toBe(true);
      expect(mockContext.res.body.presenters).toHaveLength(1);
      expect(mockContext.res.body.presenters[0].name).toBe('Jane Smith');
    });

    test('should remove presenter regardless of their presentation status', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 },
        { name: 'Jane Smith', presentationStatus: 10 }, // ASSIGNED
        { name: 'Bob Johnson', presentationStatus: 20 } // PRESENTED
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

      // Remove ASSIGNED presenter
      const req1 = { body: { name: 'Jane Smith' } };
      await removePresenterFunction(mockContext, req1);

      expect(mockContext.res.status).toBe(200);
      expect(mockContext.res.body.success).toBe(true);
      expect(mockContext.res.body.presenters).toHaveLength(2);
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle blob storage read errors', async () => {
      mockBlockBlobClient.download.mockRejectedValue(new Error('Blob storage error'));

      const req = { body: { name: 'Jane Smith' } };

      await removePresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(500);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('An error occurred while removing the presenter');
      expect(mockContext.res.body.error).toBe('Blob storage error');
    });

    test('should handle blob storage upload errors', async () => {
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

      mockBlockBlobClient.upload.mockRejectedValue(new Error('Upload failed'));

      const req = { body: { name: 'Jane Smith' } };

      await removePresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(500);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('An error occurred while removing the presenter');
      expect(mockContext.res.body.error).toBe('Upload failed');
    });
  });
});