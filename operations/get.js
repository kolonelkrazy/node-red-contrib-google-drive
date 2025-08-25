const { google } = require('googleapis');
const { handleError } = require('../utils');

module.exports = async function (drive, fileId, msg, send, done) {
    try {
        const response = await drive.files.get({
            fileId: fileId,
            fields: 'mimeType, name'
        });

        const mimeType = response.data.mimeType;
        if (mimeType.startsWith('application/vnd.google-apps.')) {
            throw new Error('Google Workspace documents must be exported using the export operation.');
        }

        const fileContentResponse = await drive.files.get({
            fileId: fileId,
            alt: 'media'
        }, {
            responseType: 'stream'
        });

        const chunks = [];
        fileContentResponse.data.on('data', chunk => chunks.push(chunk));
        fileContentResponse.data.on('end', () => {
            if (!msg.payload) {
                msg.payload = {};
            }
            msg.payload.content = Buffer.concat(chunks);
            send(msg);
            done();
        });
        fileContentResponse.data.on('error', err => {
            handleError(`[google-drive] Error fetching file content`, err, null, msg, send, done);
        });
    } catch (err) {
        handleError(`[google-drive] Error fetching file content`, err, null, msg, send, done);
    }
};
