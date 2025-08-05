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

const PRESENTATION_STATUS = {
    NOT_SELECTED: 0,
    ASSIGNED: 10,
    PRESENTED: 20,
};

module.exports = async function (context, req) {
  try {
    // Initialize blob storage client
    const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    const containerName = 'presenters';
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobName = 'presenters.json';
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Read current presenters from blob storage
    const downloadBlockBlobResponse = await blockBlobClient.download(0);
    const presentersData = await streamToString(downloadBlockBlobResponse.readableStreamBody);
    let presenters = JSON.parse(presentersData);

    // Check if there are any presenters
    if (!presenters || presenters.length === 0) {
      context.res = {
        status: 400,
        body: {
          success: false,
          message: 'No presenters found to reset',
          error: 'Empty presenter list'
        }
      };
      return;
    }

    // Count presenters by status before reset
    const statusCounts = {
      notSelected: presenters.filter(p => p.presentationStatus === PRESENTATION_STATUS.NOT_SELECTED).length,
      assigned: presenters.filter(p => p.presentationStatus === PRESENTATION_STATUS.ASSIGNED).length,
      presented: presenters.filter(p => p.presentationStatus === PRESENTATION_STATUS.PRESENTED).length
    };

    // Reset all presenters to NOT_SELECTED status
    const resetPresenters = presenters.map(presenter => ({
      ...presenter,
      presentationStatus: PRESENTATION_STATUS.NOT_SELECTED
    }));

    // Save updated list to blob storage
    const updatedData = JSON.stringify(resetPresenters);
    const uploadBlobResponse = await blockBlobClient.upload(updatedData, updatedData.length);
    
    console.log(`All presenters reset successfully. requestId: ${uploadBlobResponse.requestId}`);
    console.log(`Reset ${presenters.length} presenters (${statusCounts.assigned} assigned, ${statusCounts.presented} presented)`);

    // Return success response
    context.res = {
      status: 200,
      body: {
        presenters: resetPresenters,
        success: true,
        message: `All ${presenters.length} presenters have been reset to NOT_SELECTED status. New round started!`,
        resetCount: presenters.length,
        previousStatusCounts: statusCounts
      }
    };

  } catch (error) {
    console.error('Error resetting presenters:', error);
    
    context.res = {
      status: 500,
      body: {
        success: false,
        message: 'An error occurred while resetting presenters',
        error: error.message || 'Internal server error'
      }
    };
  }
};