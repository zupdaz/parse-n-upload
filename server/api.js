
const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const port = 4000;

// Enable CORS for all routes
app.use(cors());

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// Configure multer for file uploads
const upload = multer({ 
  dest: tempDir,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// API endpoint for particle size parsing
app.post('/api/parse-particle-size', upload.single('file'), (req, res) => {
  if (!req.file) {
    console.error('No file uploaded');
    return res.status(400).json({
      success: false,
      error: {
        message: 'No file uploaded',
        details: 'Please upload a file to parse'
      }
    });
  }

  console.log(`Received file: ${req.file.originalname} (${req.file.size} bytes)`);
  
  // Execute Python script with the temp file
  const filePath = req.file.path;
  const pythonProcess = spawn('python', [
    path.join(__dirname, 'particle_size_parser.py'),
    filePath
  ]);

  let dataString = '';
  let errorString = '';

  pythonProcess.stdout.on('data', (data) => {
    dataString += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    errorString += data.toString();
    console.error(`Python Error: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    // Clean up temp file
    fs.unlink(filePath, (err) => {
      if (err) console.error(`Failed to delete temp file: ${err}`);
    });

    if (code !== 0) {
      console.error(`Python process exited with code ${code}`);
      console.error(`Error output: ${errorString}`);
      
      return res.status(500).json({
        success: false,
        error: {
          message: 'Python parser process failed',
          details: `Exit code: ${code}. Error: ${errorString || 'No error details available'}`
        }
      });
    }

    try {
      const result = JSON.parse(dataString);
      console.log(`Successfully parsed file. Result success: ${result.success}`);
      res.json(result);
    } catch (error) {
      console.error(`Failed to parse Python output: ${error}`);
      console.error(`Raw output: ${dataString}`);
      
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to parse Python output',
          details: `JSON parsing error: ${error.message}. Raw output: ${dataString.substring(0, 200)}...`
        }
      });
    }
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Particle parser server running at http://localhost:${port}`);
});
