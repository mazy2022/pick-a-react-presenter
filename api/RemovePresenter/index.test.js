// Mock Azure Storage Blob
jest.mock('@azure/storage-blob');

const { BlobServiceClient } = require('@azure/storage-blob');
const removePresenterFunction = require('./index');

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

describe('RemovePresenter Function', () => {
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

  describe('Input Validation', () => {
    test('should return 400 when request body is missing', async () => {
      const req = {};
      
      await removePresenterFunction(context, req);
      
      expect(context.res.status).toBe(400);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('Request body is required');
    });

    test('should return 400 when name is missing', async () => {
      const req = { body: {} };
      
      await removePresenterFunction(context, req);
      
      expect(context.res.status).toBe(400);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('Presenter name is required and must be a string');
    });

    test('should return 400 when name is empty string', async () => {
      const req = { body: { name: '' } };
      
      await removePresenterFunction(context, req);
      
      expect(context.res.status).toBe(400);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('Presenter name is required and must be a string');
    });

    test('should return 400 when name is only whitespace', async () => {
      const req = { body: { name: '   ' } };
      
      await removePresenterFunction(context, req);
      
      expect(context.res.status).toBe(400);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('Presenter name cannot be empty');
    });

    test('should return 400 when name is not a string', async () => {
      const req = { body: { name: 123 } };
      
      await removePresenterFunction(context, req);
      
      expect(context.res.status).toBe(400);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('Presenter name is required and must be a string');
    });
  });

  describe('Presenter Not Found', () => {
    test('should return 404 when presenter does not exist', async () => {
      const existingPresenters = [
        { name: 'Jane Smith', presentationStatus: 0 }
      ];
      setupMockData(existingPresenters);

      const req = { body: { name: 'John Doe' } };
      
      await removePresenterFunction(context, req);
      
      expect(context.res.status).toBe(404);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('Presenter "John Doe" not found');
    });

    test('should find presenter case insensitively', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 },
        { name: 'Jane Smith', presentationStatus: 0 }
      ];
      setupMockData(existingPresenters);

      const req = { body: { name: 'JOHN DOE' } };
      
      await removePresenterFunction(context, req);
      
      expect(context.res.status).toBe(200);
      expect(context.res.body.success).toBe(true);
      expect(context.res.body.presenters).toHaveLength(1);
      expect(context.res.body.presenters[0].name).toBe('Jane Smith');
    });
  });

  describe('Last Presenter Protection', () => {
    test('should return 400 when trying to remove the last presenter', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 }
      ];
      setupMockData(existingPresenters);

      const req = { body: { name: 'John Doe' } };
      
      await removePresenterFunction(context, req);
      
      expect(context.res.status).toBe(400);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('Cannot remove the last presenter. At least one presenter must remain in the list.');
    });
  });

  describe('Successful Removal', () => {
    test('should successfully remove presenter from list', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 },
        { name: 'Jane Smith', presentationStatus: 10 },
        { name: 'Bob Wilson', presentationStatus: 20 }
      ];
      setupMockData(existingPresenters);

      const req = { body: { name: 'Jane Smith' } };
      
      await removePresenterFunction(context, req);
      
      expect(context.res.status).toBe(200);
      expect(context.res.body.success).toBe(true);
      expect(context.res.body.message).toBe('Presenter "Jane Smith" has been removed successfully');
      expect(context.res.body.presenters).toHaveLength(2);
      expect(context.res.body.presenters.map(p => p.name)).toEqual(['John Doe', 'Bob Wilson']);
    });

    test('should remove presenter from beginning of list', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 },
        { name: 'Jane Smith', presentationStatus: 0 }
      ];
      setupMockData(existingPresenters);

      const req = { body: { name: 'John Doe' } };
      
      await removePresenterFunction(context, req);
      
      expect(context.res.status).toBe(200);
      expect(context.res.body.presenters).toHaveLength(1);
      expect(context.res.body.presenters[0].name).toBe('Jane Smith');
    });

    test('should remove presenter from end of list', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 },
        { name: 'Jane Smith', presentationStatus: 0 }
      ];
      setupMockData(existingPresenters);

      const req = { body: { name: 'Jane Smith' } };
      
      await removePresenterFunction(context, req);
      
      expect(context.res.status).toBe(200);
      expect(context.res.body.presenters).toHaveLength(1);
      expect(context.res.body.presenters[0].name).toBe('John Doe');
    });

    test('should trim whitespace from presenter name', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 },
        { name: 'Jane Smith', presentationStatus: 0 }
      ];
      setupMockData(existingPresenters);

      const req = { body: { name: '  John Doe  ' } };
      
      await removePresenterFunction(context, req);
      
      expect(context.res.status).toBe(200);
      expect(context.res.body.presenters).toHaveLength(1);
      expect(context.res.body.presenters[0].name).toBe('Jane Smith');
    });

    test('should call blob storage operations correctly', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 },
        { name: 'Jane Smith', presentationStatus: 0 }
      ];
      setupMockData(existingPresenters);

      const req = { body: { name: 'John Doe' } };
      
      await removePresenterFunction(context, req);
      
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
      
      await removePresenterFunction(context, req);
      
      expect(context.res.status).toBe(500);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('An error occurred while removing the presenter');
      expect(context.res.body.error).toBe('Storage error');
    });

    test('should handle blob storage upload error', async () => {
      const existingPresenters = [
        { name: 'John Doe', presentationStatus: 0 },
        { name: 'Jane Smith', presentationStatus: 0 }
      ];
      setupMockData(existingPresenters);
      mockUpload.mockRejectedValue(new Error('Upload failed'));
      
      const req = { body: { name: 'John Doe' } };
      
      await removePresenterFunction(context, req);
      
      expect(context.res.status).toBe(500);
      expect(context.res.body.success).toBe(false);
      expect(context.res.body.message).toBe('An error occurred while removing the presenter');
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

      const req = { body: { name: 'John Doe' } };
      
      await removePresenterFunction(context, req);
      
      expect(context.res.status).toBe(500);
      expect(context.res.body.success).toBe(false);
    });
  });
});