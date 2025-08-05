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

// Validation function for presenter name
function validatePresenterName(name) {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Presenter name is required and must be a string' };
  }
  
  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    return { isValid: false, error: 'Presenter name cannot be empty' };
  }
  
  return { isValid: true, name: trimmedName };
}

// Function to find presenter by name
function findPresenterByName(presenters, name) {
  return presenters.findIndex(presenter => 
    presenter.name.toLowerCase() === name.toLowerCase()
  );
}

module.exports = async function (context, req) {
  try {
    // Validate request body
    if (!req.body) {
      context.res = {
        status: 400,
        body: {
          success: false,
          message: 'Request body is required',
          error: 'Missing request body'
        }
      };
      return;
    }

    // Validate presenter name
    const validation = validatePresenterName(req.body.name);
    if (!validation.isValid) {
      context.res = {
        status: 400,
        body: {
          success: false,
          message: validation.error,
          error: validation.error
        }
      };
      return;
    }

    const presenterName = validation.name;

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

    // Check if presenter exists
    const presenterIndex = findPresenterByName(presenters, presenterName);
    if (presenterIndex === -1) {
      context.res = {
        status: 404,
        body: {
          success: false,
          message: `Presenter "${presenterName}" not found`,
          error: 'Presenter not found'
        }
      };
      return;
    }

    // Prevent removal of last presenter
    if (presenters.length === 1) {
      context.res = {
        status: 400,
        body: {
          success: false,
          message: 'Cannot remove the last presenter. At least one presenter must remain in the list.',
          error: 'Cannot remove last presenter'
        }
      };
      return;
    }

    // Remove the presenter from the list
    const removedPresenter = presenters[presenterIndex];
    presenters.splice(presenterIndex, 1);

    // Save updated list to blob storage
    const updatedData = JSON.stringify(presenters);
    const uploadBlobResponse = await blockBlobClient.upload(updatedData, updatedData.length);
    
    console.log(`Presenter "${presenterName}" removed successfully. requestId: ${uploadBlobResponse.requestId}`);

    // Return success response
    context.res = {
      status: 200,
      body: {
        presenters: presenters,
        success: true,
        message: `Presenter "${presenterName}" has been removed successfully`
      }
    };

  } catch (error) {
    console.error('Error removing presenter:', error);
    
    context.res = {
      status: 500,
      body: {
        success: false,
        message: 'An error occurred while removing the presenter',
        error: error.message || 'Internal server error'
      }
    };
  }
};