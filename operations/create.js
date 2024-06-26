const { handleError } = require('../utils');
const mime = require('mime-types');
const handleMimeType = require('../mime-types');

module.exports = async function handleCreate(drive, params, msg, send, done) {
    try {
        const folderId = params.folderId;
        const fileName = params.fileName;
        const content = params.content; // Assuming content is a string or JSON object

        const resource = {
            name: fileName,
            parents: folderId ? [folderId] : []
        };

        let media = null;

        if (content) {
            const mimeType = mime.lookup(fileName) || 'application/octet-stream';

            // Set content directly as body (string or JSON object)
            media = {
                mimeType,
                body: content
            };
        }

        // Create file with specified resource and media
        const result = await drive.files.create({
            resource,
            media,
            fields: 'id, name, mimeType, parents'
        });

        const fileMetadata = result.data;

        // Ensure msg.payload is initialized
        msg.payload = msg.payload || {};

        // Add file metadata to payload
        msg.payload.metadata = fileMetadata;

        // Handle the file content based on MIME type
        await handleMimeType(drive, fileMetadata.id, fileMetadata.mimeType, msg, send, done);

    } catch (err) {
        // Handle errors using the handleError function
        handleError(`[google-drive] Error in create operation: ${err.message}`, err, null, msg, send, done);
    }
};
