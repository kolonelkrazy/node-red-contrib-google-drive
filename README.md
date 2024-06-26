# Node-RED Google Drive Integration

This Node-RED module provides nodes to interact with Google Drive using OAuth2.

## Installation

To install, use the following command in your Node-RED directory:

```sh
npm install @lexiraeanna/node-red-contrib-google-drive
```
## Setup

### Google API Credentials Configuration

1. Drag and drop the **Google Drive API** node into your Node-RED flow.
2. Click on "Add new google-credentials" to create a **google-credentials configuration** node.
3. Configure the node with your OAuth 2.0 credentials:
   - **Client ID**: Your OAuth 2.0 Client ID obtained from Google Cloud Console.
   - **Client Secret**: Your OAuth 2.0 Client Secret obtained from Google Cloud Console.
   - **Redirect URI**: URL where Google should redirect after authorization (e.g., `http://localhost:1880/google-credentials/auth/callback`).
   - **Scopes**: Scopes required for Google Drive API access (e.g., `https://www.googleapis.com/auth/drive`).

4. Click **Start Authorization** to begin the OAuth 2.0 authorization process.

### Google Drive API Node Configuration

1. Add the **Google Drive** API node to your Node-RED flow.
2. Configure the node:
   - **Name**: Give your node a descriptive name.
   - **Google Credentials**: Select the configured Google Credentials node.
   - **Operation**: Choose the operation you want to perform (e.g., list, get, create, update, delete).
   - Configure additional parameters based on the selected operation:
     - **Folder ID**: ID of the folder for operations like list or create.
     - **File ID**: ID of the file for operations like get, update, or delete.
     - **File Name**: Name of the file to create or update.

3. Deploy your Node-RED flow to apply the changes.

## Usage

- Use the configured Node-RED flow to interact with Google Drive:
  - **List Files**: Lists files in a specified folder.
  - **Get File**: Retrieves metadata or content for a specific file.
  - **Create File**: Uploads a new file to Google Drive.
  - **Update File**: Updates metadata or content of an existing file.
  - **Delete File**: Deletes a file from Google Drive.
  - **Export File**: Exports a file in a specified MIME type.

- If you would like to preview the file's contents prior to deploying your flow, click on the "Fetch File Content" button next to the file ID. Your file's data will populate in the content and metadata fields, and as an alert pop-up for the operations without them.
