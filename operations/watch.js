const { handleError } = require('../utils');

module.exports = async function handleWatch(drive, params, msg, send, done) {
    try {
        const fileId = params.fileId;
        const watchParams = msg.payload;

        if (!fileId) throw new Error(`[google-drive] Missing required parameter: fileId for operation 'watch'`);

        const result = await drive.files.watch({
            fileId,
            resource: watchParams
        });

        msg.payload = { watch: result.data };
        send(msg);
        if (done) done();
    } catch (err) {
        handleError(`[google-drive] Error in watch operation: ${err.message}`, err, null, msg, send, done);
    }
};
