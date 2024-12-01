const fs = require('fs');
const path = require('path');
const https = require('https');

const TESSDATA_URL = 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/main/eng.traineddata';
const TESSDATA_PATH = path.join(process.cwd(), 'public', 'tessdata');
const LANG_FILE = path.join(TESSDATA_PATH, 'eng.traineddata');

// Create tessdata directory if it doesn't exist
if (!fs.existsSync(TESSDATA_PATH)) {
  fs.mkdirSync(TESSDATA_PATH, { recursive: true });
}

// Download eng.traineddata if it doesn't exist
if (!fs.existsSync(LANG_FILE)) {
  console.log('Downloading English language data...');
  const file = fs.createWriteStream(LANG_FILE);
  https.get(TESSDATA_URL, response => {
    response.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log('Download completed!');
    });
  }).on('error', err => {
    fs.unlink(LANG_FILE);
    console.error('Error downloading language data:', err.message);
  });
} else {
  console.log('English language data already exists.');
}
