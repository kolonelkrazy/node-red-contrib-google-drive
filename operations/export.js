const { google } = require('googleapis');
const { handleError } = require('../utils');

module.exports = async function (drive, fileId, msg, send, done) {
    try {
        const fileMetadata = await drive.files.get({
            fileId: fileId,
            fields: 'mimeType'
        });

        const mimeType = fileMetadata.data.mimeType;
        let exportMimeType = 'text/plain'; // Default export MIME type

        if (mimeType === 'application/vnd.google-apps.document') {
            exportMimeType = 'text/plain';
        } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
            exportMimeType = 'text/csv';
        } else if (mimeType === 'application/vnd.google-apps.presentation') {
            exportMimeType = 'text/plain';
        } else if (mimeType === 'application/vnd.google-apps.script') {
            exportMimeType = 'application/vnd.google-apps.script+json';
        }

        const response = await drive.files.export({
            fileId: fileId,
            mimeType: exportMimeType
        }, {
            responseType: 'stream'
        });

        const chunks = [];
        response.data.on('data', chunk => chunks.push(chunk));
        response.data.on('end', () => {
            if (!msg.payload) {
                msg.payload = {};
            }
            msg.payload.content = Buffer.concat(chunks).toString();
            send(msg);
            done();
        });
        response.data.on('error', err => {
            handleError(`[google-drive] Error exporting file`, err, null, msg, send, done);
        });
    } catch (err) {
        handleError(`[google-drive] Error exporting file`, err, null, msg, send, done);
    }
};
