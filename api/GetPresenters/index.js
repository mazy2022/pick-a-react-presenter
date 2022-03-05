const { BlobServiceClient } = require('@azure/storage-blob');

// A helper function used to read a Node.js readable stream into a string
async function streamToString(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on("data", (data) => {
      chunks.push(data.toString());
    });
    readableStream.on("end", () => {
      resolve(chunks.join(""));
    });
    readableStream.on("error", reject);
  });
}

module.exports = async function (context, req) {
  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
  
    // Get a reference to a container
    const containerName = 'presenters';
    const containerClient = blobServiceClient.getContainerClient(containerName);
  
    // blob name
    const blobName = 'presenters.json';
  
    // Get a block blob client
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const downloadBlockBlobResponse = await blockBlobClient.download(0);
  
    // parse blob contents into string
    const presenters = await streamToString(downloadBlockBlobResponse.readableStreamBody);
  
    context.res = {
      status: 200,
      body: {
        presenters: JSON.parse(presenters),
      },
    };
  } catch (error) {
    context.res = {
      status: 500,
      body: {
        error:JSON.stringify(error),
      },
    };
  }
}