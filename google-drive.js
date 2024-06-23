module.exports = function (RED) {
    "use strict";

    const { google } = require('googleapis');
    const backoff = require('backoff');

    function GoogleDriveNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.configNode = RED.nodes.getNode(config.googleCredentials);

        if (!node.configNode) {
            const errorMessage = "[google-drive] Google Drive configuration node is not set.";
            console.error(errorMessage);
            node.error(errorMessage);
            return;
        }

        console.log(`[google-drive] Google Drive node initialized with ID: ${this.id}`);

        node.on('input', async function (msg, send, done) {
            // Preserve and prioritize operation from message
            const operation = msg.operation || config.operation;
            const params = msg.payload || {};

            // Resolve dynamic folderId, fileId, and fileName
            const folderId = RED.util.evaluateNodeProperty(config.folderId, config.folderIdType, node, msg) || msg.folderId;
            const fileId = RED.util.evaluateNodeProperty(config.fileId, config.fileIdType, node, msg) || msg.fileId;
            const fileName = RED.util.evaluateNodeProperty(config.fileName, config.fileNameType, node, msg) || msg.fileName;

            // Add folderId, fileId, or fileName to params if available
            if (operation === "list" && folderId) {
                params.q = `'${folderId}' in parents`;
            } else if ((operation === "get" || operation === "delete") && fileId) {
                params.fileId = fileId;
            } else if (operation === "create" && folderId && fileName) {
                params.parents = [folderId];
                params.name = fileName;
            } else if (operation === "update" && fileId) {
                params.fileId = fileId;
                if (fileName) params.name = fileName;
                if (msg.media) params.media = msg.media; // optional: file content, if updating local data
            }

            // Validation
            if (!params.fileId && (operation === "get" || operation === "delete" || operation === "update")) {
                const errorMessage = `[google-drive] Missing required parameter: fileId for operation ${operation}`;
                console.error(errorMessage);
                node.error(errorMessage, msg);
                return;
            }
            if (operation === "create" && (!params.parents || !params.name)) {
                const errorMessage = `[google-drive] Missing required parameters: folderId or fileName for operation ${operation}`;
                console.error(errorMessage);
                node.error(errorMessage, msg);
                return;
            }

            node.status({ fill: 'blue', shape: 'dot', text: 'processing' });

            try {
                const oauth2Client = await node.configNode.getClient();
                if (!oauth2Client) throw new Error('OAuth2 client is not initialized.');

                const drive = google.drive({ version: 'v3', auth: oauth2Client });

                let result;
                switch (operation) {
                    case 'list':
                        result = await drive.files.list(params);
                        break;
                    case 'get':
                        result = await drive.files.get({ fileId: params.fileId });
                        break;
                    case 'create':
                        result = await drive.files.create({
                            resource: { name: params.name, parents: params.parents },
                            media: msg.media // optional: file content, if creating from local data
                        });
                        break;
                    case 'update':
                        result = await drive.files.update({
                            fileId: params.fileId,
                            resource: { name: params.name },
                            media: msg.media // optional: file content, if updating local data
                        });
                        break;
                    case 'delete':
                        result = await drive.files.delete({ fileId: params.fileId });
                        break;
                    default:
                        throw new Error(`[google-drive] Invalid operation: ${operation}`);
                }

                msg.payload = result.data;
                node.status({ fill: 'green', shape: 'dot', text: 'success' });
                console.log(`[google-drive] Operation ${operation} successful`);
                send(msg);
                if (done) done();
            } catch (err) {
                handleRequestError(err, node, msg, send, done);
            }
        });

        function handleRequestError(err, node, msg, send, done) {
            const errorMessage = `[google-drive] Error in operation: ${err.message}`;
            node.status({ fill: 'red', shape: 'dot', text: 'error' });
            console.error(errorMessage);
            node.error(errorMessage);

            const exponentialBackoff = backoff.exponential({
                initialDelay: 100,
                maxDelay: 60000,
                factor: 2
            });

            exponentialBackoff.failAfter(5);
            exponentialBackoff.on('backoff', (number, delay) => {
                const warningMessage = `[google-drive] Retrying request (${number + 1}) after ${delay}ms: ${err.message}`;
                console.warn(warningMessage);
                node.warn(warningMessage);
            });

            exponentialBackoff.on('fail', () => {
                const failureMessage = `[google-drive] Request failed after multiple retries: ${err.message}`;
                console.error(failureMessage);
                node.error(failureMessage, msg);
                if (done) done(failureMessage);
            });

            exponentialBackoff.on('ready', async () => {
                try {
                    const oauth2Client = await node.configNode.getClient();
                    if (!oauth2Client) throw new Error('OAuth2 client is not initialized.');

                    const drive = google.drive({ version: 'v3', auth: oauth2Client });
                    let result;

                    switch (msg.operation) {
                        case 'list':
                            result = await drive.files.list(msg.payload);
                            break;
                        case 'get':
                            result = await drive.files.get(msg.payload);
                            break;
                        case 'create':
                            result = await drive.files.create(msg.payload);
                            break;
                        case 'update':
                            result = await drive.files.update(msg.payload);
                            break;
                        case 'delete':
                            result = await drive.files.delete(msg.payload);
                            break;
                        default:
                            throw new Error('[google-drive] Invalid operation');
                    }

                    msg.payload = result.data;
                    node.status({ fill: 'green', shape: 'dot', text: 'success' });
                    console.log(`[google-drive] Operation ${msg.operation} retry successful`);
                    send(msg);
                    if (done) done();
                } catch (retryErr) {
                    console.error(`[google-drive] Error in retry operation: ${retryErr.message}`);
                    exponentialBackoff.backoff();
                }
            });

            exponentialBackoff.backoff();
        }
    }

    RED.nodes.registerType("Google Drive", GoogleDriveNode, {
        defaults: {
            name: { value: "" },
            googleCredentials: { type: "google-credentials", required: true },
            operation: { value: "list", required: true },
            folderId: { value: "", required: false },
            folderIdType: { value: "str" },
            fileId: { value: "", required: false },
            fileIdType: { value: "str" },
            fileName: { value: "", required: false },
            fileNameType: { value: "str" }
        }
    });
};
