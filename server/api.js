
const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

// Set up CORS to allow requests from your React app
app.use(cors());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Preserve original filename for the python parser
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// Clean up temporary files older than 1 hour
function cleanupTempFiles() {
  const uploadDir = path.join(__dirname, 'uploads');
  if (fs.existsSync(uploadDir)) {
    fs.readdir(uploadDir, (err, files) => {
      if (err) return console.error('Error reading upload directory:', err);
      
      const oneHourAgo = Date.now() - 3600000;
      
      files.forEach(file => {
        const filePath = path.join(uploadDir, file);
        fs.stat(filePath, (err, stats) => {
          if (err) return console.error(`Error getting stats for file ${file}:`, err);
          
          if (stats.mtimeMs < oneHourAgo) {
            fs.unlink(filePath, err => {
              if (err) console.error(`Error deleting file ${file}:`, err);
            });
          }
        });
      });
    });
  }
}

// Run cleanup every hour
setInterval(cleanupTempFiles, 3600000);

// Endpoint for parsing particle size files
app.post('/api/parse-particle-size', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ 
      success: false, 
      error: { 
        message: 'No file uploaded',
        details: 'Please provide a file to parse'
      } 
    });
  }

  const filePath = req.file.path;
  
  // Execute the Python parser script with the file path
  const pythonProcess = spawn('python', [
    path.join(__dirname, 'particle_size_parser.py'),
    filePath
  ]);

  let dataString = '';
  let errorString = '';

  pythonProcess.stdout.on('data', data => {
    dataString += data.toString();
  });

  pythonProcess.stderr.on('data', data => {
    errorString += data.toString();
  });

  pythonProcess.on('close', code => {
    if (code !== 0) {
      return res.status(500).json({
        success: false,
        error: {
          message: 'Python parser execution failed',
          details: errorString || 'No error details available'
        }
      });
    }

    try {
      // Parse the JSON output from the Python script
      const result = JSON.parse(dataString);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to parse Python script output',
          details: `Error: ${error.message}. Output: ${dataString}`
        }
      });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
