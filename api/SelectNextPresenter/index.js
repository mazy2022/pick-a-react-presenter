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
    const presenters = await streamToString(downloadBlockBlobResponse.readableStreamBody);
    const data = JSON.parse(presenters);
    let remaining = data.filter(person => person.presentationStatus === PRESENTATION_STATUS.NOT_SELECTED);
    if (remaining.length === 0) {
        remaining = data.map(person => {
            return {
                ...person,
                presentationStatus: PRESENTATION_STATUS.NOT_SELECTED,
            };
        });
    }

    const assigned = data.find(person => person.presentationStatus === PRESENTATION_STATUS.ASSIGNED);
    assigned.presentationStatus = PRESENTATION_STATUS.PRESENTED;
    const randomIndex = Math.floor(Math.random() * remaining.length);
    remaining[randomIndex].presentationStatus = PRESENTATION_STATUS.ASSIGNED;
    
    const newList = JSON.stringify(data);
    
    // Upload data to the blob
    const uploadBlobResponse = await blockBlobClient.upload(newList, newList.length);
    console.log("Blob was uploaded successfully. requestId: ", uploadBlobResponse.requestId);

    context.res = {
      status: 200,
      body: {
        presenters: JSON.parse(newList),
      },
    };
  } catch (error) {
    context.res = {
      status: 500,
      body: {
        error: JSON.stringify(error),
      },
    };
  }
}