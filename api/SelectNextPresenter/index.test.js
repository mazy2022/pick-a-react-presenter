const selectNextPresenterFunction = require('./index');

// Mock Azure Storage Blob
jest.mock('@azure/storage-blob');
const { BlobServiceClient } = require('@azure/storage-blob');

describe('SelectNextPresenter Azure Function (Enhanced)', () => {
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

    // Mock Math.random for predictable testing
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

      await selectNextPresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(400);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('No presenters available for selection');
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

      await selectNextPresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(400);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('No presenters available for selection');
    });
  });

  describe('Normal Selection Tests', () => {
    test('should successfully select a presenter when some are available', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 }, // NOT_SELECTED
        { name: 'Jane Smith', presentationStatus: 0 }, // NOT_SELECTED
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

      const req = {};

      await selectNextPresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(200);
      expect(mockContext.res.body.success).toBe(true);
      expect(mockContext.res.body.autoResetOccurred).toBe(false);
      expect(mockContext.res.body.remainingCount).toBe(1); // 2 available - 1 selected = 1 remaining
      expect(mockContext.res.body.selectedPresenter).toBeDefined();
      expect(mockContext.res.body.selectedPresenter.presentationStatus).toBe(10); // ASSIGNED

      // With Math.random() = 0.5, should select index 1 (Jane Smith)
      expect(mockContext.res.body.selectedPresenter.name).toBe('Jane Smith');
      expect(mockContext.res.body.message).toBe('Presenter "Jane Smith" has been selected');
    });

    test('should mark currently assigned presenter as presented', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 }, // NOT_SELECTED
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

      const req = {};

      await selectNextPresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(200);
      expect(mockContext.res.body.success).toBe(true);

      // Jane Smith should now be marked as PRESENTED
      const janeSmith = mockContext.res.body.presenters.find(p => p.name === 'Jane Smith');
      expect(janeSmith.presentationStatus).toBe(20); // PRESENTED

      // John Doe should be selected (only remaining NOT_SELECTED)
      expect(mockContext.res.body.selectedPresenter.name).toBe('John Doe');
      expect(mockContext.res.body.selectedPresenter.presentationStatus).toBe(10); // ASSIGNED
    });
  });

  describe('Auto-Reset Tests', () => {
    test('should auto-reset when all presenters are presented or assigned', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 20 }, // PRESENTED
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

      const req = {};

      await selectNextPresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(200);
      expect(mockContext.res.body.success).toBe(true);
      expect(mockContext.res.body.autoResetOccurred).toBe(true);
      expect(mockContext.res.body.message).toContain('All presenters had been selected. Starting a new round!');

      // All presenters should be reset to NOT_SELECTED except the newly selected one
      const notSelectedCount = mockContext.res.body.presenters.filter(p => p.presentationStatus === 0).length;
      const assignedCount = mockContext.res.body.presenters.filter(p => p.presentationStatus === 10).length;
      const presentedCount = mockContext.res.body.presenters.filter(p => p.presentationStatus === 20).length;

      expect(notSelectedCount).toBe(2); // 2 reset to NOT_SELECTED
      expect(assignedCount).toBe(1); // 1 newly selected
      expect(presentedCount).toBe(0); // All reset during auto-reset

      // Verify the selected presenter
      expect(mockContext.res.body.selectedPresenter).toBeDefined();
      expect(mockContext.res.body.selectedPresenter.presentationStatus).toBe(10);
    });

    test('should handle auto-reset with single presenter', async () => {
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

      await selectNextPresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(200);
      expect(mockContext.res.body.success).toBe(true);
      expect(mockContext.res.body.autoResetOccurred).toBe(true);
      expect(mockContext.res.body.selectedPresenter.name).toBe('John Doe');
      expect(mockContext.res.body.selectedPresenter.presentationStatus).toBe(10); // ASSIGNED
      expect(mockContext.res.body.remainingCount).toBe(0); // No more remaining after selection
    });

    test('should preserve presenter properties during auto-reset', async () => {
      const existingPresenters = [
        { 
          name: 'John Doe', 
          presentationStatus: 20,
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

      await selectNextPresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(200);
      expect(mockContext.res.body.success).toBe(true);
      expect(mockContext.res.body.autoResetOccurred).toBe(true);

      // Verify properties are preserved
      const johnDoe = mockContext.res.body.presenters.find(p => p.name === 'John Doe');
      expect(johnDoe.id).toBe('uuid-123');
      expect(johnDoe.addedDate).toBe('2023-01-01T00:00:00.000Z');
      expect(johnDoe.customProperty).toBe('test');

      const janeSmith = mockContext.res.body.presenters.find(p => p.name === 'Jane Smith');
      expect(janeSmith.id).toBe('uuid-456');
      expect(janeSmith.addedDate).toBe('2023-01-02T00:00:00.000Z');
    });
  });

  describe('Random Selection Tests', () => {
    test('should select first presenter when Math.random returns 0', async () => {
      Math.random.mockReturnValue(0);

      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 },
        { name: 'Jane Smith', presentationStatus: 0 },
        { name: 'Bob Johnson', presentationStatus: 0 }
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

      await selectNextPresenterFunction(mockContext, req);

      expect(mockContext.res.body.selectedPresenter.name).toBe('John Doe');
    });

    test('should select last presenter when Math.random returns close to 1', async () => {
      Math.random.mockReturnValue(0.99);

      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 },
        { name: 'Jane Smith', presentationStatus: 0 },
        { name: 'Bob Johnson', presentationStatus: 0 }
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

      await selectNextPresenterFunction(mockContext, req);

      expect(mockContext.res.body.selectedPresenter.name).toBe('Bob Johnson');
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle blob storage read errors', async () => {
      mockBlockBlobClient.download.mockRejectedValue(new Error('Blob storage error'));

      const req = {};

      await selectNextPresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(500);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('An error occurred while selecting the next presenter');
      expect(mockContext.res.body.error).toBe('Blob storage error');
    });

    test('should handle blob storage upload errors', async () => {
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

      mockBlockBlobClient.upload.mockRejectedValue(new Error('Upload failed'));

      const req = {};

      await selectNextPresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(500);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('An error occurred while selecting the next presenter');
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

      await selectNextPresenterFunction(mockContext, req);

      expect(mockContext.res.status).toBe(500);
      expect(mockContext.res.body.success).toBe(false);
      expect(mockContext.res.body.message).toBe('An error occurred while selecting the next presenter');
    });
  });
});