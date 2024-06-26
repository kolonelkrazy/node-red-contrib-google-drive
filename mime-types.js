const { handleError } = require('./utils');
const handleExport = require('./operations/export');

async function handleMimeType(drive, fileId, mimeType, msg, send, done) {
    try {
        // Initialize msg.payload if it's undefined
        msg.payload = msg.payload || {};

        if (mimeType.startsWith('application/vnd.google-apps.')) {
            // Handle Google Workspace files by exporting them
            await handleExport(drive, fileId, mimeType, msg, send, done);
        } else if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
            // Handle PDFs and images by setting the content to the file name
            msg.payload.content = fileId; // Adjust as needed, e.g., using fileId or response.name
        } else if (mimeType.startsWith('text/') || mimeType === 'application/json') {
            // Handle text files and JSON
            const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
            const chunks = [];
            
            response.data.on('data', chunk => chunks.push(chunk));
            response.data.on('end', () => {
                msg.payload.content = Buffer.concat(chunks).toString();
               // send(msg); // Send the modified msg once content is set
               // done(); // Mark the message as done
            });

            // Return to avoid sending msg prematurely
            return;

        } else {
            // For other binary types, set the content to the file name
            msg.payload.content = fileId; // Adjust as needed, e.g., using fileId or response.name
        }

        // Send the modified msg and mark as done
       // send(msg);
       // done();

    } catch (err) {
        handleError(`[google-drive] Error processing file content`, err, null, msg, send, done);
    }
}

module.exports = handleMimeType;
