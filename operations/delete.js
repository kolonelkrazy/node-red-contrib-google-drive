const { handleError } = require('../utils');

module.exports = async function handleDelete(drive, params, msg, send, done) {
    try {
        console.log(`[google-drive] handleDelete called with params: ${JSON.stringify(params)}`);

        const fileId = params.fileId;

        if (!fileId) throw new Error(`[google-drive] Missing required parameter: fileId for operation 'delete'`);

        console.log(`[google-drive] Getting file metadata for fileId: ${fileId}`);
        const fileMetadata = await drive.files.get({ fileId, fields: 'name' });

        console.log(`[google-drive] Deleting file with fileId: ${fileId}`);
        await drive.files.delete({ fileId });

        console.log(`[google-drive] File deleted successfully. FileName: ${fileMetadata.data.name}`);
        msg.payload = { success: true, fileId, fileName: fileMetadata.data.name };
        send(msg);
        if (done) done();
    } catch (err) {
        handleError(`[google-drive] Error in delete operation: ${err.message}`, err, null, msg, send, done);
    }
};
