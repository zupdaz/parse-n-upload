
# Deploying to IIS

This document provides instructions for deploying this React application to Internet Information Services (IIS).

## Prerequisites

1. Windows Server with IIS installed
2. URL Rewrite Module for IIS
3. Node.js (for building the application)

## Build Process

1. Set your base path if deploying to a subdirectory:
   ```
   set BASE_PATH=/your-subdirectory/
   npm run build
   ```
   
   If deploying to the root of a site, simply run:
   ```
   npm run build
   ```

2. The build output will be in the `dist` directory.

## IIS Configuration

1. Create a new website or application in IIS Manager.
2. Set the physical path to the `dist` directory.
3. Ensure the application pool is configured correctly:
   - .NET CLR version: "No Managed Code"
   - Managed pipeline mode: "Integrated"

4. Make sure the `web.config` file is present in the root of your deployed application (it should be copied automatically during the build).

5. Install the URL Rewrite Module for IIS if not already installed.

6. Set correct permissions:
   - The IIS_IUSRS group should have Read & Execute permissions on the application folder.

## Troubleshooting

- If you see 404 errors for your routes, ensure the URL Rewrite module is installed and the web.config is correctly formatted.
- If static assets aren't loading, check MIME type configurations in IIS.
- For any issues, examine the IIS logs located in the `%SystemDrive%\inetpub\logs\LogFiles` directory.

## Environment Specific Configuration

If you need different configurations for different environments, consider:

1. Creating multiple web.config transforms
2. Using environment variables during the build process
3. Configuring IIS to set environment variables for the application

## Note on API Requests

If your application makes API requests:

1. Ensure CORS is properly configured if the API is on a different domain.
2. Consider using absolute URLs or configuring a proxy in IIS.
