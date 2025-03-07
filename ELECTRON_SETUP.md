
# Setting up the Electron Application

This application requires an Electron environment to fully support particle size file parsing functionality. The Python parser is integrated through Electron's IPC mechanism.

## Requirements

1. Node.js and npm
2. Python 3.7+ with the following packages:
   - pandas
   - numpy
   - re
   - csv
   - logging

## Electron Main Process Implementation

In your Electron main process (main.js), implement the following IPC handlers:

```javascript
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');

// IPC handler for saving temporary files
ipcMain.handle('save-temp-file', async (event, fileName, fileData) => {
  const tempDir = path.join(os.tmpdir(), 'particle-parser');
  
  // Create temp directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(fileData));
  
  return filePath;
});

// IPC handler for running the Python parser
ipcMain.handle('run-python-parser', async (event, filePath) => {
  return new Promise((resolve, reject) => {
    // Path to the Python script relative to the application
    const scriptPath = path.join(app.getAppPath(), 'resources', 'particle_size_parser.py');
    
    // Spawn Python process
    const pythonProcess = spawn('python', [scriptPath, filePath]);
    
    let stdoutData = '';
    let stderrData = '';
    
    // Collect stdout data
    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });
    
    // Collect stderr data
    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });
    
    // Handle process completion
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        resolve({
          success: false,
          error: {
            message: 'Python parser process failed',
            details: stderrData || 'No error details available'
          }
        });
        return;
      }
      
      try {
        const result = JSON.parse(stdoutData);
        resolve(result);
      } catch (error) {
        resolve({
          success: false,
          error: {
            message: 'Failed to parse Python output',
            details: error.message
          }
        });
      }
    });
    
    // Handle process error
    pythonProcess.on('error', (error) => {
      resolve({
        success: false,
        error: {
          message: 'Failed to start Python process',
          details: error.message
        }
      });
    });
  });
});
```

## Preload Script (preload.js)

Expose the IPC handlers to the renderer process:

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  saveTempFile: (fileName, data) => ipcRenderer.invoke('save-temp-file', fileName, data),
  runPythonParser: (filePath) => ipcRenderer.invoke('run-python-parser', filePath)
});
```

## Packaging the Application

When packaging the Electron application:

1. Copy the `particle_size_parser.py` file to the `resources` directory of your application.
2. Make sure Python is installed on the target system, along with the required packages.

You can use the following script to install required Python packages:

```bash
pip install pandas numpy
```

## Web Version Fallback

The web version will display a message indicating that particle size file parsing requires the desktop application.
