const { BlobServiceClient } = require('@azure/storage-blob');

async function streamToString(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => {
      chunks.push(data.toString());
    });
    readableStream.on('end', () => {
      resolve(chunks.join(''));
    });
    readableStream.on('error', reject);
  });
}

const PRESENTATION_STATUS = {
  NOT_SELECTED: 0,
  ASSIGNED: 10,
  PRESENTED: 20,
};

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

function validateAvatar(avatar) {
  if (!avatar) {
    return { isValid: true, avatar: undefined };
  }

  if (typeof avatar !== 'string' || !avatar.startsWith('data:image/')) {
    return { isValid: false, error: 'Avatar must be a valid image data URL' };
  }

  return { isValid: true, avatar };
}

function checkDuplicateName(presenters, name) {
  return presenters.some((presenter) => presenter.name.toLowerCase() === name.toLowerCase());
}

module.exports = async function (context, req) {
  try {
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

    const avatarValidation = validateAvatar(req.body.avatar);
    if (!avatarValidation.isValid) {
      context.res = {
        status: 400,
        body: {
          success: false,
          message: avatarValidation.error,
          error: avatarValidation.error
        }
      };
      return;
    }

    const presenterName = validation.name;

    const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient('presenters');
    const blockBlobClient = containerClient.getBlockBlobClient('presenters.json');

    const downloadBlockBlobResponse = await blockBlobClient.download(0);
    const presentersData = await streamToString(downloadBlockBlobResponse.readableStreamBody);
    const presenters = JSON.parse(presentersData);

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

    const newPresenter = {
      name: presenterName,
      presentationStatus: PRESENTATION_STATUS.NOT_SELECTED,
      id: require('crypto').randomUUID(),
      addedDate: new Date().toISOString(),
      avatar: avatarValidation.avatar,
    };

    presenters.push(newPresenter);

    const updatedData = JSON.stringify(presenters);
    const uploadBlobResponse = await blockBlobClient.upload(updatedData, updatedData.length);

    console.log(`Presenter "${presenterName}" added successfully. requestId: ${uploadBlobResponse.requestId}`);

    context.res = {
      status: 200,
      body: {
        presenters,
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
