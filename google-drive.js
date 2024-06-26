const { google } = require('googleapis');
const { handleRequestError, resolveProperty, getOAuthClient } = require('./utils');

module.exports = function (RED) {
    function GoogleDriveNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.configNode = RED.nodes.getNode(config.googleCredentials);

        if (!node.configNode) {
            const errorMessage = '[google-drive] Google Drive configuration node is not set.';
            console.error(errorMessage);
            node.error(errorMessage);
            return;
        }

        console.log(`[google-drive] Google Drive node initialized with ID: ${this.id}`);

        node.on('input', async function (msg, send, done) {
            try {
                const operation = msg.operation || config.operation;

                let folderId = resolveProperty(RED, config.folderId, config.folderIdType, node, msg) || msg.folderId || '';
                let fileId = resolveProperty(RED, config.fileId, config.fileIdType, node, msg) || msg.fileId || '';
                let fileName = resolveProperty(RED, config.fileName, config.fileNameType, node, msg) || msg.fileName || '';
                let content = resolveProperty(RED, config.content, config.contentType, node, msg) || msg.content || '';
                let metadata = resolveProperty(RED, config.metadata, config.metadataType, node, msg) || msg.metadata || '';
                let uploadType = resolveProperty(RED, config.uploadType, config.uploadTypeType, node, msg) || msg.uploadType || '';

                const params = { folderId, fileId, fileName, content, metadata, uploadType };

                node.status({ fill: 'blue', shape: 'dot', text: 'processing' });

                const oauth2Client = await node.configNode.getClient();
                if (!oauth2Client) throw new Error('OAuth2 client is not initialized.');

                const drive = google.drive({ version: 'v3', auth: oauth2Client });

                // Handle operation
                switch (operation) {
                    case 'list':
                        await require('./operations/list')(drive, params, msg, send, done);
                        break;
                    case 'get':
                        if (!fileId) throw new Error(`[google-drive] Missing required parameter: fileId for operation 'get'`);
                        await require('./operations/get')(drive, fileId, msg, send, done);
                        break;
                    case 'export':
                        if (!fileId) throw new Error(`[google-drive] Missing required parameter: fileId for operation 'export'`);
                        await require('./operations/export')(drive, fileId, msg, send, done);
                        break;
                    case 'create':
                        await require('./operations/create')(drive, params, msg, send, done);
                        break;
                    case 'update':
                        if (!fileId) throw new Error(`[google-drive] Missing required parameter: fileId for operation 'update'`);
                        await require('./operations/update')(drive, params, msg, send, done);
                        break;
                    case 'delete':
                        if (!fileId) throw new Error(`[google-drive] Missing required parameter: fileId for operation 'delete'`);
                        await require('./operations/delete')(drive, params, msg, send, done);
                        break;
                    case 'watch':
                        if (!fileId) throw new Error(`[google-drive] Missing required parameter: fileId for operation 'watch'`);
                        await require('./operations/watch')(drive, params, msg, send, done);
                        break;
                    default:
                        throw new Error(`[google-drive] Invalid operation: ${operation}`);
                }

                node.status({ fill: 'green', shape: 'dot', text: 'success' });
                console.log(`[google-drive] Operation ${operation} successful`);
                if (done) done();
            } catch (err) {
                handleRequestError(err, node, msg, send, done);
            }
        });

    // Expose an endpoint to fetch file content
    RED.httpAdmin.get('/google-drive/fetch-file-content', async function(req, res) {
        const fileId = req.query.fileId;
        const credentialsId = req.query.credentialsId;
        const configNode = RED.nodes.getNode(credentialsId);

        if (!fileId || !configNode) {
            return res.status(400).send({ error: 'Missing fileId or credentialsId' });
        }

        try {
            const oauth2Client = await configNode.getClient();
            const drive = google.drive({ version: 'v3', auth: oauth2Client });

            // Fetch the file metadata to check the MIME type
            const fileMetadata = await drive.files.get({
                fileId: fileId,
                fields: 'mimeType'
            });

            const mimeType = fileMetadata.data.mimeType;
            console.log(`[google-drive] MIME type: ${mimeType}`);

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

            // Handle MIME type
            if (mimeType.startsWith('application/vnd.google-apps.')) {
                // Use export for Google Workspace files
                const exportResponse = await drive.files.export({
                    fileId: fileId,
                    mimeType: exportMimeType
                }, {
                    responseType: 'stream'
                });

                const chunks = [];
                exportResponse.data.on('data', chunk => chunks.push(chunk));
                exportResponse.data.on('end', () => {
                    const fileContent = Buffer.concat(chunks).toString();
                    res.send({ fileContent });
                });
                exportResponse.data.on('error', err => {
                    res.status(500).send({ error: err.message });
                });
            } else {
                // Use get for other files
                const getResponse = await drive.files.get({
                    fileId: fileId,
                    alt: 'media'
                }, {
                    responseType: 'stream'
                });

                const chunks = [];
                getResponse.data.on('data', chunk => chunks.push(chunk));
                getResponse.data.on('end', () => {
                    const fileContent = Buffer.concat(chunks).toString();
                    res.send({ fileContent });
                });
                getResponse.data.on('error', err => {
                    res.status(500).send({ error: err.message });
                });
            }
        } catch (err) {
            res.status(500).send({ error: `Error fetching file content: ${err.message}` });
        }
    });

    // Expose an endpoint to fetch file metadata
    RED.httpAdmin.get('/google-drive/fetch-file-metadata', async function(req, res) {
        const fileId = req.query.fileId;
        const credentialsId = req.query.credentialsId;
        const configNode = RED.nodes.getNode(credentialsId);

        if (!fileId || !configNode) {
            return res.status(400).send({ error: 'Missing fileId or credentialsId' });
        }

        try {
            const oauth2Client = await configNode.getClient();
            const drive = google.drive({ version: 'v3', auth: oauth2Client });

            const response = await drive.files.get({ fileId, fields: '*' });
            res.send({ fileMetadata: response.data });
        } catch (err) {
            res.status(500).send({ error: `Error fetching file metadata: ${err.message}` });
        }
    });

}

    RED.nodes.registerType('Google Drive', GoogleDriveNode, {
        defaults: {
            name: { value: '' },
            googleCredentials: { type: 'google-credentials', required: true },
            operation: { value: 'list', required: true },
            folderId: { value: '', type: 'typedInput', required: false },
            folderIdType: { value: 'str' },
            fileId: { value: '', type: 'typedInput', required: false },
            fileIdType: { value: 'str' },
            fileName: { value: '', type: 'typedInput', required: false },
            fileNameType: { value: 'str' },
            content: { value: '', required: false },
            contentType: { value: 'str' },
            metadata: { value: '', required: false },
            metadataType: { value: 'str' },
            uploadType: { value: '', type: 'str', required: false },
            uploadTypeType: { value: 'str' }
        }
    });
};
