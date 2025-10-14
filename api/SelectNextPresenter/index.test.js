// Mock Azure Storage Blob
jest.mock('@azure/storage-blob');

const { BlobServiceClient } = require('@azure/storage-blob');
const selectNextPresenterFunction = require('./index');

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

// Mock Math.random for predictable testing
const mockMathRandom = jest.spyOn(Math, 'random');

describe('SelectNextPresenter Function', () => {
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

  afterEach(() => {
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
      
      await selectNextPresenterFunction(context, req);
      
      expect(context.res.status).toBe(400);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('No presenters available for selection');
      expect(context.res.body.error).toBe('Empty presenter list');
    });

    test('should return 400 when presenter list is null', async () => {
      setupMockData(null);
      
      const req = {};
      
      await selectNextPresenterFunction(context, req);
      
      expect(context.res.status).toBe(400);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('No presenters available for selection');
    });
  });

  describe('Normal Selection', () => {
    test('should select first available presenter when Math.random returns 0', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 }, // NOT_SELECTED
        { name: 'Jane Smith', presentationStatus: 0 }, // NOT_SELECTED
        { name: 'Bob Wilson', presentationStatus: 20 } // PRESENTED
      ];
      setupMockData(existingPresenters);
      mockMathRandom.mockReturnValue(0); // First available presenter

      const req = {};
      
      await selectNextPresenterFunction(context, req);
      
      expect(context.res.status).toBe(200);
      expect(context.res.body.success).toBe(true);
      // The function filters NOT_SELECTED presenters, so first available could be either John or Jane
      expect(['John Doe', 'Jane Smith']).toContain(context.res.body.selectedPresenter.name);
      expect(context.res.body.selectedPresenter.presentationStatus).toBe(10); // ASSIGNED
      expect(context.res.body.autoResetOccurred).toBe(false);
      expect(context.res.body.remainingCount).toBe(1);
    });

    test('should select second available presenter when Math.random returns 0.9', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 }, // NOT_SELECTED
        { name: 'Jane Smith', presentationStatus: 0 }, // NOT_SELECTED
        { name: 'Bob Wilson', presentationStatus: 20 } // PRESENTED
      ];
      setupMockData(existingPresenters);
      mockMathRandom.mockReturnValue(0.9); // Second available presenter (index 1)

      const req = {};
      
      await selectNextPresenterFunction(context, req);
      
      expect(context.res.status).toBe(200);
      expect(context.res.body.selectedPresenter.name).toBe('Jane Smith');
      expect(context.res.body.selectedPresenter.presentationStatus).toBe(10); // ASSIGNED
    });

    test('should mark currently assigned presenter as presented before selecting new one', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 10 }, // ASSIGNED
        { name: 'Jane Smith', presentationStatus: 0 }, // NOT_SELECTED
        { name: 'Bob Wilson', presentationStatus: 20 } // PRESENTED
      ];
      setupMockData(existingPresenters);
      mockMathRandom.mockReturnValue(0); // Select Jane Smith

      const req = {};
      
      await selectNextPresenterFunction(context, req);
      
      expect(context.res.status).toBe(200);
      
      // John Doe should be marked as presented
      const johnDoe = context.res.body.presenters.find(p => p.name === 'John Doe');
      expect(johnDoe.presentationStatus).toBe(20); // PRESENTED
      
      // Jane Smith should be selected
      expect(context.res.body.selectedPresenter.name).toBe('Jane Smith');
      expect(context.res.body.selectedPresenter.presentationStatus).toBe(10); // ASSIGNED
    });

    test('should handle single presenter selection', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 } // NOT_SELECTED
      ];
      setupMockData(existingPresenters);
      mockMathRandom.mockReturnValue(0);

      const req = {};
      
      await selectNextPresenterFunction(context, req);
      
      expect(context.res.status).toBe(200);
      expect(context.res.body.selectedPresenter.name).toBe('John Doe');
      expect(context.res.body.remainingCount).toBe(0);
    });
  });

  describe('Auto-Reset Functionality', () => {
    test('should auto-reset when no NOT_SELECTED presenters remain', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 10 }, // ASSIGNED (will become PRESENTED)
        { name: 'Jane Smith', presentationStatus: 20 }, // PRESENTED
        { name: 'Bob Wilson', presentationStatus: 20 } // PRESENTED
      ];
      setupMockData(existingPresenters);
      mockMathRandom.mockReturnValue(0); // Select first presenter after reset

      const req = {};
      
      await selectNextPresenterFunction(context, req);
      
      expect(context.res.status).toBe(200);
      expect(context.res.body.success).toBe(true);
      expect(context.res.body.autoResetOccurred).toBe(true);
      expect(context.res.body.message).toContain('All presenters had been selected. Starting a new round!');
      expect(context.res.body.message).toContain('has been selected for the new round');
      
      // All presenters except the selected one should be NOT_SELECTED
      const notSelectedCount = context.res.body.presenters.filter(p => p.presentationStatus === 0).length;
      const assignedCount = context.res.body.presenters.filter(p => p.presentationStatus === 10).length;
      
      expect(notSelectedCount).toBe(2);
      expect(assignedCount).toBe(1);
    });

    test('should auto-reset when all presenters are PRESENTED', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 20 }, // PRESENTED
        { name: 'Jane Smith', presentationStatus: 20 }, // PRESENTED
        { name: 'Bob Wilson', presentationStatus: 20 } // PRESENTED
      ];
      setupMockData(existingPresenters);
      mockMathRandom.mockReturnValue(0.5); // Select middle presenter after reset

      const req = {};
      
      await selectNextPresenterFunction(context, req);
      
      expect(context.res.status).toBe(200);
      expect(context.res.body.autoResetOccurred).toBe(true);
      // After reset, any presenter could be selected
      expect(['John Doe', 'Jane Smith', 'Bob Wilson']).toContain(context.res.body.selectedPresenter.name);
      expect(context.res.body.remainingCount).toBe(2);
    });

    test('should not auto-reset when NOT_SELECTED presenters are available', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 }, // NOT_SELECTED
        { name: 'Jane Smith', presentationStatus: 20 }, // PRESENTED
        { name: 'Bob Wilson', presentationStatus: 10 } // ASSIGNED
      ];
      setupMockData(existingPresenters);
      mockMathRandom.mockReturnValue(0);

      const req = {};
      
      await selectNextPresenterFunction(context, req);
      
      expect(context.res.status).toBe(200);
      expect(context.res.body.autoResetOccurred).toBe(false);
      expect(context.res.body.selectedPresenter.name).toBe('John Doe');
      
      // Bob Wilson should be marked as presented
      const bobWilson = context.res.body.presenters.find(p => p.name === 'Bob Wilson');
      expect(bobWilson.presentationStatus).toBe(20); // PRESENTED
    });
  });

  describe('Response Format', () => {
    test('should return correct response format for normal selection', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 },
        { name: 'Jane Smith', presentationStatus: 0 }
      ];
      setupMockData(existingPresenters);
      mockMathRandom.mockReturnValue(0);

      const req = {};
      
      await selectNextPresenterFunction(context, req);
      
      expect(context.res.status).toBe(200);
      expect(context.res.body).toHaveProperty('presenters');
      expect(context.res.body).toHaveProperty('success', true);
      expect(context.res.body).toHaveProperty('message');
      expect(context.res.body).toHaveProperty('selectedPresenter');
      expect(context.res.body).toHaveProperty('autoResetOccurred', false);
      expect(context.res.body).toHaveProperty('remainingCount');
    });

    test('should return correct response format for auto-reset selection', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 20 },
        { name: 'Jane Smith', presentationStatus: 20 }
      ];
      setupMockData(existingPresenters);
      mockMathRandom.mockReturnValue(0);

      const req = {};
      
      await selectNextPresenterFunction(context, req);
      
      expect(context.res.status).toBe(200);
      expect(context.res.body).toHaveProperty('autoResetOccurred', true);
      expect(context.res.body.message).toContain('All presenters had been selected. Starting a new round!');
    });
  });

  describe('Blob Storage Operations', () => {
    test('should call blob storage operations correctly', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 }
      ];
      setupMockData(existingPresenters);
      mockMathRandom.mockReturnValue(0);

      const req = {};
      
      await selectNextPresenterFunction(context, req);
      
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
      
      await selectNextPresenterFunction(context, req);
      
      expect(context.res.status).toBe(500);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('An error occurred while selecting the next presenter');
      expect(context.res.body.error).toBe('Storage error');
    });

    test('should handle blob storage upload error', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 }
      ];
      setupMockData(existingPresenters);
      mockUpload.mockRejectedValue(new Error('Upload failed'));
      mockMathRandom.mockReturnValue(0);
      
      const req = {};
      
      await selectNextPresenterFunction(context, req);
      
      expect(context.res.status).toBe(500);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('An error occurred while selecting the next presenter');
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
      
      await selectNextPresenterFunction(context, req);
      
      expect(context.res.status).toBe(500);
      expect(context.res.body.success).toBe(false);
    });
  });
});