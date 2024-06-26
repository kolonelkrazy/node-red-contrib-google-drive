const { handleError } = require('../utils');

module.exports = async function handleList(drive, params, msg, send, done) {
    try {
        const folderId = params.folderId || 'root';
        const result = await drive.files.list({
            q: `'${folderId}' in parents`,
            fields: 'files(id, name, mimeType, parents)'
        });

        msg.payload = { files: result.data.files };
        send(msg);
        if (done) done();
    } catch (err) {
        handleError(`[google-drive] Error in list operation: ${err.message}`, err, null, msg, send, done);
    }
};
