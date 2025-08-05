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
  
  if (trimmedName.length > 100) {
    return { isValid: false, error: 'Presenter name cannot exceed 100 characters' };
  }
  
  return { isValid: true, name: trimmedName };
}

// Function to check for duplicate names
function checkDuplicateName(presenters, name) {
  return presenters.some(presenter => 
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

    // Check for duplicate names
    if (checkDuplicateName(presenters, presenterName)) {
      context.res = {
        status: 400,
        body: {
          success: false,
          message: `A presenter with the name "${presenterName}" already exists`,
          error: 'Duplicate presenter name'
        }
      };
      return;
    }

    // Create new presenter object
    const newPresenter = {
      name: presenterName,
      presentationStatus: PRESENTATION_STATUS.NOT_SELECTED,
      id: require('crypto').randomUUID(),
      addedDate: new Date().toISOString()
    };

    // Add new presenter to the list
    presenters.push(newPresenter);

    // Save updated list to blob storage
    const updatedData = JSON.stringify(presenters);
    const uploadBlobResponse = await blockBlobClient.upload(updatedData, updatedData.length);
    
    console.log(`Presenter "${presenterName}" added successfully. requestId: ${uploadBlobResponse.requestId}`);

    // Return success response
    context.res = {
      status: 200,
      body: {
        presenters: presenters,
        success: true,
        message: `Presenter "${presenterName}" has been added successfully`
      }
    };

  } catch (error) {
    console.error('Error adding presenter:', error);
    
    context.res = {
      status: 500,
      body: {
        success: false,
        message: 'An error occurred while adding the presenter',
        error: error.message || 'Internal server error'
      }
    };
  }
};