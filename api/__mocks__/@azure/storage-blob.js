// Manual mock for @azure/storage-blob
const BlobServiceClient = {
  fromConnectionString: jest.fn()
};

module.exports = {
  BlobServiceClient
};