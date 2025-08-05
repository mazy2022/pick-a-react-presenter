const resetPresentersFunction = require('./index');

// Mock Azure Storage Blob
jest.mock('@azure/storage-blob');
const { BlobServiceClient } = require('@azure/storage-blob');

describe('ResetPresenters Azure Function', () => {
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

  describe('Empty Presenter List Tests', () => {
    test('should return 400 when presenter list is empty', async () => {
      const emptyPresenters = [];

      // Mock blob storage response
      const mockReadableStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify(emptyPresenters));
          } else if (event === 'end') {
            callback();
          }
        })
      };

      mockBlockBlobClient.download.mockResolvedValue({
        readableStreamBody: mockReadableStream
      });

      const req = {};

      await resetPresentersFunction(mockContext, req);

      expect(mockContext.res.status).toBe(400);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('No presenters found to reset');
      expect(mockContext.res.body.error).toBe('Empty presenter list');
    });

    test('should return 400 when presenter list is null', async () => {
      // Mock blob storage response
      const mockReadableStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(JSON.stringify(null));
          } else if (event === 'end') {
            callback();
          }
        })
      };

      mockBlockBlobClient.download.mockResolvedValue({
        readableStreamBody: mockReadableStream
      });

      const req = {};

      await resetPresentersFunction(mockContext, req);

      expect(mockContext.res.status).toBe(400);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('No presenters found to reset');
    });
  });

  describe('Successful Reset Tests', () => {
    test('should successfully reset all presenters to NOT_SELECTED status', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 }, // NOT_SELECTED
        { name: 'Jane Smith', presentationStatus: 10 }, // ASSIGNED
        { name: 'Bob Johnson', presentationStatus: 20 }, // PRESENTED
        { name: 'Alice Brown', presentationStatus: 20 } // PRESENTED
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

      const req = {};

      await resetPresentersFunction(mockContext, req);

      expect(mockContext.res.status).toBe(200);
      expect(mockContext.res.body.success).toBe(true);
      expect(mockContext.res.body.message).toBe('All 4 presenters have been reset to NOT_SELECTED status. New round started!');
      expect(mockContext.res.body.resetCount).toBe(4);
      expect(mockContext.res.body.previousStatusCounts).toEqual({
        notSelected: 1,
        assigned: 1,
        presented: 2
      });

      // Verify all presenters have NOT_SELECTED status
      expect(mockContext.res.body.presenters).toHaveLength(4);
      mockContext.res.body.presenters.forEach(presenter => {
        expect(presenter.presentationStatus).toBe(0); // NOT_SELECTED
      });

      // Verify presenter names are preserved
      const presenterNames = mockContext.res.body.presenters.map(p => p.name);
      expect(presenterNames).toContain('John Doe');
      expect(presenterNames).toContain('Jane Smith');
      expect(presenterNames).toContain('Bob Johnson');
      expect(presenterNames).toContain('Alice Brown');
    });

    test('should reset presenters that are already NOT_SELECTED', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 }, // NOT_SELECTED
        { name: 'Jane Smith', presentationStatus: 0 } // NOT_SELECTED
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

      const req = {};

      await resetPresentersFunction(mockContext, req);

      expect(mockContext.res.status).toBe(200);
      expect(mockContext.res.body.success).toBe(true);
      expect(mockContext.res.body.resetCount).toBe(2);
      expect(mockContext.res.body.previousStatusCounts).toEqual({
        notSelected: 2,
        assigned: 0,
        presented: 0
      });

      // Verify all presenters still have NOT_SELECTED status
      mockContext.res.body.presenters.forEach(presenter => {
        expect(presenter.presentationStatus).toBe(0);
      });
    });

    test('should preserve all presenter properties except status', async () => {
      const existingPresenters = [
        { 
          name: 'John Doe', 
          presentationStatus: 10,
          id: 'uuid-123',
          addedDate: '2023-01-01T00:00:00.000Z',
          customProperty: 'test'
        },
        { 
          name: 'Jane Smith', 
          presentationStatus: 20,
          id: 'uuid-456',
          addedDate: '2023-01-02T00:00:00.000Z'
        }
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

      const req = {};

      await resetPresentersFunction(mockContext, req);

      expect(mockContext.res.status).toBe(200);
      expect(mockContext.res.body.success).toBe(true);

      // Verify properties are preserved
      const johnDoe = mockContext.res.body.presenters.find(p => p.name === 'John Doe');
      expect(johnDoe.presentationStatus).toBe(0);
      expect(johnDoe.id).toBe('uuid-123');
      expect(johnDoe.addedDate).toBe('2023-01-01T00:00:00.000Z');
      expect(johnDoe.customProperty).toBe('test');

      const janeSmith = mockContext.res.body.presenters.find(p => p.name === 'Jane Smith');
      expect(janeSmith.presentationStatus).toBe(0);
      expect(janeSmith.id).toBe('uuid-456');
      expect(janeSmith.addedDate).toBe('2023-01-02T00:00:00.000Z');
    });

    test('should handle single presenter reset', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 20 } // PRESENTED
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

      const req = {};

      await resetPresentersFunction(mockContext, req);

      expect(mockContext.res.status).toBe(200);
      expect(mockContext.res.body.success).toBe(true);
      expect(mockContext.res.body.resetCount).toBe(1);
      expect(mockContext.res.body.previousStatusCounts).toEqual({
        notSelected: 0,
        assigned: 0,
        presented: 1
      });
      expect(mockContext.res.body.presenters[0].presentationStatus).toBe(0);
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle blob storage read errors', async () => {
      mockBlockBlobClient.download.mockRejectedValue(new Error('Blob storage error'));

      const req = {};

      await resetPresentersFunction(mockContext, req);

      expect(mockContext.res.status).toBe(500);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('An error occurred while resetting presenters');
      expect(mockContext.res.body.error).toBe('Blob storage error');
    });

    test('should handle blob storage upload errors', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 10 }
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

      const req = {};

      await resetPresentersFunction(mockContext, req);

      expect(mockContext.res.status).toBe(500);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('An error occurred while resetting presenters');
      expect(mockContext.res.body.error).toBe('Upload failed');
    });

    test('should handle JSON parsing errors', async () => {
      // Mock blob storage response with invalid JSON
      const mockReadableStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback('invalid json');
          } else if (event === 'end') {
            callback();
          }
        })
      };

      mockBlockBlobClient.download.mockResolvedValue({
        readableStreamBody: mockReadableStream
      });

      const req = {};

      await resetPresentersFunction(mockContext, req);

      expect(mockContext.res.status).toBe(500);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('An error occurred while resetting presenters');
    });
  });
});