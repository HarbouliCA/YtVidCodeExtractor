import cv2
import pytesseract
import json
import os
import sys
from PIL import Image
import shutil
import logging
from typing import List, Dict

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_tesseract_installation():
    """Verify Tesseract is properly installed and configured."""
    try:
        pytesseract.get_tesseract_version()
        return True
    except Exception as e:
        logger.error("""
Tesseract OCR is not properly installed or configured. Please follow these steps:

1. Download Tesseract installer from: https://github.com/UB-Mannheim/tesseract/wiki
2. Run the installer and make sure to check 'Add to PATH' during installation
3. Default install location: C:\\Program Files\\Tesseract-OCR
4. Restart your terminal/IDE after installation
5. Run 'tesseract --version' to verify installation

Error details: %s
""", str(e))
        return False

def has_code_content(text: str) -> bool:
    """Detect if text contains code-like content."""
    code_indicators = [
        # Symbols commonly found in code
        '{', '}', '[', ']', '(', ')', ';', '==', '!=', '+=', '-=', '=>',
        # Common programming keywords
        'function', 'class', 'const', 'let', 'var', 'if', 'else', 'for', 'while',
        'return', 'import', 'from', 'def', 'print', 'public', 'private', 'static'
    ]
    
    return any(indicator in text for indicator in code_indicators)

def extract_frames_with_ocr(video_path: str, output_dir: str) -> List[Dict]:
    """Extract frames from video and perform OCR on each frame."""
    if not check_tesseract_installation():
        return []

    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Open video file
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        logger.error("Error: Could not open video file")
        return []
    
    frames_data = []
    frame_count = 0
    fps = cap.get(cv2.CAP_PROP_FPS)
    
    while cap.isOpened():
        # Read frame
        ret, frame = cap.read()
        if not ret:
            break
            
        # Get current timestamp
        timestamp = frame_count / fps
        
        try:
            # Save frame as image
            frame_filename = f'frame-{timestamp}.jpg'
            frame_path = os.path.join(output_dir, frame_filename)
            cv2.imwrite(frame_path, frame)
            
            # Perform OCR
            text = pytesseract.image_to_string(Image.open(frame_path))
            has_code = has_code_content(text)
            
            frames_data.append({
                'filename': frame_filename,
                'timestamp': timestamp,
                'has_code': has_code,
                'text': text.strip()
            })
            
        except Exception as e:
            logger.error("Error processing frame at %ss: %s", timestamp, str(e))
        
        frame_count += 1
        
        # Extract one frame per second
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_count * fps)
    
    cap.release()
    
    # Write frames data to JSON file
    data_path = os.path.join(output_dir, 'frames_data.json')
    with open(data_path, 'w', encoding='utf-8') as f:
        json.dump(frames_data, f, ensure_ascii=False, indent=2)
    
    return frames_data

if __name__ == "__main__":
    if len(sys.argv) != 3:
        logger.error("Usage: python frame_extractor.py <video_path> <output_dir>")
        sys.exit(1)
        
    video_path = sys.argv[1]
    output_dir = sys.argv[2]
    
    try:
        frames_data = extract_frames_with_ocr(video_path, output_dir)
        print(json.dumps(frames_data))  # Print JSON data to stdout for Node.js to capture
    except Exception as e:
        logger.error("Error: %s", str(e))
        sys.exit(1)
