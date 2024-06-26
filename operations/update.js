const { google } = require('googleapis');
const { handleError } = require('../utils');

module.exports = async function (drive, params, msg, send, done) {
    try {
        const { fileId, fileName, content, metadata, uploadType } = params;

        console.log('[google-drive] Params:', params);

        // Initialize the requestBody with fileName
        let requestBody = {
            name: fileName,
        };

        // Log the initial metadata and content
        console.log('[google-drive] Initial metadata:', metadata ? metadata : 'No metadata provided');
        console.log('[google-drive] Initial content:', content);

        // Attempt to parse the metadata if it's provided and not empty
        if (metadata) {
            try {
                const parsedMetadata = JSON.parse(metadata);
                requestBody = {
                    ...requestBody,
                    ...parsedMetadata
                };
                console.log('[google-drive] Parsed metadata:', parsedMetadata);
            } catch (parseError) {
                console.error('[google-drive] Invalid metadata JSON provided:', metadata);
                throw new Error('Invalid metadata JSON provided');
            }
        }

        // Create the media object and set the mimeType
        let media = {
            body: content,
        };

        if (fileName.endsWith('.json')) {
            media.mimeType = 'application/json';
        } else if (fileName.endsWith('.txt')) {
            media.mimeType = 'text/plain';
        } else {
            media.mimeType = 'application/octet-stream'; // Default MIME type for other file types
        }

        console.log('[google-drive] Request body before update:', requestBody);
        console.log('[google-drive] Media object before update:', media);

        let response;

        // Fetch the current file content before update
        let previousContent = '';
        try {
            const currentFileResponse = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
            const chunks = [];
            currentFileResponse.data.on('data', chunk => chunks.push(chunk));
            currentFileResponse.data.on('end', () => {
                previousContent = Buffer.concat(chunks).toString();
            });
        } catch (error) {
            console.error('[google-drive] Error fetching current file content:', error);
            throw new Error('Error fetching current file content');
        }

        // Perform the update based on the upload type
        console.log('[google-drive] Upload type:', uploadType);
        if (uploadType === 'media') {
            response = await drive.files.update({
                fileId,
                requestBody,
                media,
            });

            msg.payload = {
                previousContent: previousContent,
                newContent: content
            };
        } else if (uploadType === 'multipart') {
            response = await drive.files.update({
                fileId,
                requestBody,
                media: {
                    mimeType: media.mimeType,
                    body: content
                }
            });

            msg.payload = {
                previousContent: previousContent,
                newContent: content,
                previousMetadata: JSON.parse(metadata || '{}'),
                newMetadata: requestBody
            };
        } else {
            throw new Error('[google-drive] Invalid or missing upload type');
        }

        // Log the response status and URL
        console.log('[google-drive] Response status:', response.status);
        console.log('[google-drive] Response URL:', response.request.responseURL);

        // Check if response and response.data are defined
        if (!response || !response.data) {
            throw new Error('No data received from Google Drive API');
        }

        console.log('[google-drive] Operation update successful');
        send(msg);
        done();
    } catch (err) {
        console.error('[google-drive] Error:', err);

        // Additional detailed logging for specific errors
        if (err.response) {
            console.error('[google-drive] API response error:', err.response.data);
        }
        if (err.request) {
            console.error('[google-drive] API request error:', err.request);
        }

        handleError('[google-drive] Error updating file', err, null, msg, send, done);
    }
};
