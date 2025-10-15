// Mock Azure Storage Blob
jest.mock('@azure/storage-blob');

const { BlobServiceClient } = require('@azure/storage-blob');
const resetPresentersFunction = require('./index');

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

describe('ResetPresenters Function', () => {
  let context;
  let mockReadableStream;

  beforeEach(() => {
    context = {
      res: {}
    };
    
    mockUpload.mockResolvedValue({
      requestId: 'test-request-id'
    });

    // Clear all mocks
    jest.clearAllMocks();
  });

  const setupMockData = (presenters) => {
    mockReadableStream = {
      on: jest.fn((event, callback) => {
        if (event === 'data') {
          callback(JSON.stringify(presenters));
        } else if (event === 'end') {
          callback();
        }
      })
    };

    mockDownload.mockResolvedValue({
      readableStreamBody: mockReadableStream
    });
  };

  describe('Empty Presenter List', () => {
    test('should return 400 when presenter list is empty', async () => {
      setupMockData([]);
      
      const req = {};
      
      await resetPresentersFunction(context, req);
      
      expect(context.res.status).toBe(400);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('No presenters found to reset');
      expect(context.res.body.error).toBe('Empty presenter list');
    });

    test('should return 400 when presenter list is null', async () => {
      setupMockData(null);
      
      const req = {};
      
      await resetPresentersFunction(context, req);
      
      expect(context.res.status).toBe(400);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('No presenters found to reset');
    });
  });

  describe('Successful Reset', () => {
    test('should reset all presenters to NOT_SELECTED status', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 10 }, // ASSIGNED
        { name: 'Jane Smith', presentationStatus: 20 }, // PRESENTED
        { name: 'Bob Wilson', presentationStatus: 0 }, // NOT_SELECTED
        { name: 'Alice Brown', presentationStatus: 20 } // PRESENTED
      ];
      setupMockData(existingPresenters);

      const req = {};
      
      await resetPresentersFunction(context, req);
      
      expect(context.res.status).toBe(200);
      expect(context.res.body.success).toBe(true);
      expect(context.res.body.message).toBe('All 4 presenters have been reset to NOT_SELECTED status. New round started!');
      expect(context.res.body.presenters).toHaveLength(4);
      
      // All presenters should have status 0 (NOT_SELECTED)
      context.res.body.presenters.forEach(presenter => {
        expect(presenter.presentationStatus).toBe(0);
      });
    });

    test('should preserve presenter names and other properties', async () => {
      const existingPresenters = [
        { 
          name: 'John Doe', 
          presentationStatus: 10,
          id: 'uuid-1',
          addedDate: '2023-01-01T00:00:00.000Z'
        },
        { 
          name: 'Jane Smith', 
          presentationStatus: 20,
          id: 'uuid-2',
          addedDate: '2023-01-02T00:00:00.000Z'
        }
      ];
      setupMockData(existingPresenters);

      const req = {};
      
      await resetPresentersFunction(context, req);
      
      expect(context.res.status).toBe(200);
      expect(context.res.body.presenters[0]).toEqual({
        name: 'John Doe',
        presentationStatus: 0,
        id: 'uuid-1',
        addedDate: '2023-01-01T00:00:00.000Z'
      });
      expect(context.res.body.presenters[1]).toEqual({
        name: 'Jane Smith',
        presentationStatus: 0,
        id: 'uuid-2',
        addedDate: '2023-01-02T00:00:00.000Z'
      });
    });

    test('should return correct status counts in response', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 }, // NOT_SELECTED
        { name: 'Jane Smith', presentationStatus: 10 }, // ASSIGNED
        { name: 'Bob Wilson', presentationStatus: 10 }, // ASSIGNED
        { name: 'Alice Brown', presentationStatus: 20 }, // PRESENTED
        { name: 'Charlie Davis', presentationStatus: 20 } // PRESENTED
      ];
      setupMockData(existingPresenters);

      const req = {};
      
      await resetPresentersFunction(context, req);
      
      expect(context.res.status).toBe(200);
      expect(context.res.body.resetCount).toBe(5);
      expect(context.res.body.previousStatusCounts).toEqual({
        notSelected: 1,
        assigned: 2,
        presented: 2
      });
    });

    test('should handle single presenter reset', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 20 }
      ];
      setupMockData(existingPresenters);

      const req = {};
      
      await resetPresentersFunction(context, req);
      
      expect(context.res.status).toBe(200);
      expect(context.res.body.success).toBe(true);
      expect(context.res.body.message).toBe('All 1 presenters have been reset to NOT_SELECTED status. New round started!');
      expect(context.res.body.presenters).toHaveLength(1);
      expect(context.res.body.presenters[0].presentationStatus).toBe(0);
    });

    test('should handle presenters already in NOT_SELECTED status', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 },
        { name: 'Jane Smith', presentationStatus: 0 }
      ];
      setupMockData(existingPresenters);

      const req = {};
      
      await resetPresentersFunction(context, req);
      
      expect(context.res.status).toBe(200);
      expect(context.res.body.success).toBe(true);
      expect(context.res.body.previousStatusCounts).toEqual({
        notSelected: 2,
        assigned: 0,
        presented: 0
      });
    });

    test('should call blob storage operations correctly', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 10 }
      ];
      setupMockData(existingPresenters);

      const req = {};
      
      await resetPresentersFunction(context, req);
      
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
      
      const req = {};
      
      await resetPresentersFunction(context, req);
      
      expect(context.res.status).toBe(500);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('An error occurred while resetting presenters');
      expect(context.res.body.error).toBe('Storage error');
    });

    test('should handle blob storage upload error', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 10 }
      ];
      setupMockData(existingPresenters);
      mockUpload.mockRejectedValue(new Error('Upload failed'));
      
      const req = {};
      
      await resetPresentersFunction(context, req);
      
      expect(context.res.status).toBe(500);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('An error occurred while resetting presenters');
    });

    test('should handle JSON parse error', async () => {
      mockReadableStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback('invalid json');
          } else if (event === 'end') {
            callback();
          }
        })
      };

      mockDownload.mockResolvedValue({
        readableStreamBody: mockReadableStream
      });

      const req = {};
      
      await resetPresentersFunction(context, req);
      
      expect(context.res.status).toBe(500);
      expect(context.res.body.success).toBe(false);
    });
  });
});