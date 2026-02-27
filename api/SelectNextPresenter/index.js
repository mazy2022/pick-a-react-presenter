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
    const presentersData = await streamToString(downloadBlockBlobResponse.readableStreamBody);
    let data = JSON.parse(presentersData);

    // Check if there are any presenters
    if (!data || data.length === 0) {
      context.res = {
        status: 400,
        body: {
          success: false,
          message: 'No presenters available for selection',
          error: 'Empty presenter list'
        }
      };
      return;
    }

    // Track if auto-reset occurred
    let autoResetOccurred = false;
    let resetMessage = '';

    // Mark currently assigned presenter as presented first
    const assigned = data.find(person => person.presentationStatus === PRESENTATION_STATUS.ASSIGNED);
    if (assigned) {
      assigned.presentationStatus = PRESENTATION_STATUS.PRESENTED;
      console.log(`Marked presenter "${assigned.name}" as presented`);
    }

    // Get remaining presenters (NOT_SELECTED)
    let remaining = data.filter(person => person.presentationStatus === PRESENTATION_STATUS.NOT_SELECTED);
    
    // Auto-reset logic: if no presenters are available, reset all to NOT_SELECTED
    if (remaining.length === 0) {
      autoResetOccurred = true;
      resetMessage = 'All presenters had been selected. Starting a new round!';
      
      // Reset all presenters to NOT_SELECTED status
      data = data.map(person => ({
        ...person,
        presentationStatus: PRESENTATION_STATUS.NOT_SELECTED,
      }));
      
      // Update remaining list after reset
      remaining = data.filter(person => person.presentationStatus === PRESENTATION_STATUS.NOT_SELECTED);
      
      console.log(`Auto-reset triggered: Reset ${data.length} presenters to start new round`);
    }

    // Randomly select next presenter from remaining
    const randomIndex = Math.floor(Math.random() * remaining.length);
    const selectedPresenter = remaining[randomIndex];
    selectedPresenter.presentationStatus = PRESENTATION_STATUS.ASSIGNED;

    // Save updated data to blob storage
    const updatedData = JSON.stringify(data);
    const uploadBlobResponse = await blockBlobClient.upload(updatedData, updatedData.length);
    
    console.log(`Presenter "${selectedPresenter.name}" selected successfully. requestId: ${uploadBlobResponse.requestId}`);

    // Prepare response message
    let message = `Presenter "${selectedPresenter.name}" has been selected`;
    if (autoResetOccurred) {
      message = `${resetMessage} ${selectedPresenter.name} has been selected for the new round`;
    }

    // Return success response with consistent format
    context.res = {
      status: 200,
      body: {
        presenters: data,
        success: true,
        message: message,
        selectedPresenter: selectedPresenter,
        autoResetOccurred: autoResetOccurred,
        remainingCount: remaining.length - 1 // Subtract 1 because we just selected one
      }
    };

  } catch (error) {
    console.error('Error selecting next presenter:', error);
    
    context.res = {
      status: 500,
      body: {
        success: false,
        message: 'An error occurred while selecting the next presenter',
        error: error.message || 'Internal server error'
      }
    };
  }
}