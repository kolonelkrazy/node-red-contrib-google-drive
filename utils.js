const { google } = require('googleapis');

module.exports = {
    getOAuthClient: async function (configNode) {
        const oauth2Client = await configNode.getClient();
        return oauth2Client;
    },

    handleRequestError: function (err, node, msg, send, done) {
        const errorMessage = `[google-drive] Error: ${err.message}`;
        console.error(errorMessage, err);
        if (node) {
            node.error(errorMessage, msg);
            node.status({ fill: 'red', shape: 'dot', text: 'error' });
        }
        if (done) done(err.message);
    },

    handleError: function (message, err, node, msg, send, done) {
        const errorMessage = `${message}: ${err.message}`;
        console.error(errorMessage, err);
        if (node) {
            node.error(errorMessage, msg);
            node.status({ fill: 'red', shape: 'dot', text: 'error' });
        }
        if (done) done(err.message);
    },

    resolveProperty: function (RED, property, propertyType, node, msg) {
        try {
            let value;
            switch (propertyType) {
                case 'msg':
                    value = RED.util.getMessageProperty(msg, property);
                    break;
                case 'flow':
                    value = node.context().flow.get(property);
                    break;
                case 'global':
                    value = node.context().global.get(property);
                    break;
                case 'env':
                    value = process.env[property];
                    break;
                case 'str':
                case 'json':
                    value = property;
                    break;
                case 'num':
                    value = parseFloat(property);
                    break;
                case 'bool':
                    value = property === 'true';
                    break;
                default:
                    value = "";
                    break;
            }
            return value;
        } catch (err) {
            console.error(`Error in resolveProperty: ${err.message}`);
            return undefined;
        }
    },

    fetchFileContent: async function (configNode, fileId) {
        try {
            const oauth2Client = await this.getOAuthClient(configNode);
            const drive = google.drive({ version: 'v3', auth: oauth2Client });

            const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
            const chunks = [];

            return new Promise((resolve, reject) => {
                response.data.on('data', chunk => chunks.push(chunk));
                response.data.on('end', () => {
                    const fileContent = Buffer.concat(chunks).toString();
                    resolve(fileContent);
                });
                response.data.on('error', err => reject(err));
            });
        } catch (err) {
            throw new Error(`Error fetching file content: ${err.message}`);
        }
    }
};
