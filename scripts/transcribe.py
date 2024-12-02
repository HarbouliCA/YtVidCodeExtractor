import sys
import json
import whisper
import argparse
import warnings
from datetime import datetime, timezone
from typing import Dict, List, Optional

# Filter out specific warnings
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=DeprecationWarning)

def transcribe_audio(audio_path: str, model_name: str = "base") -> Dict:
    """
    Transcribe audio using Whisper and return segments with metadata
    """
    try:
        # Load Whisper model
        print("Status: Loading Whisper model", file=sys.stderr)
        model = whisper.load_model(model_name)
        
        # Transcribe audio
        print("Status: Starting transcription", file=sys.stderr)
        result = model.transcribe(
            audio_path,
            verbose=False,  # Disable verbose output
            language="en",  # Force English for better accuracy
            fp16=False  # Use CPU if GPU not available
        )
        
        # Process segments
        segments = []
        for segment in result["segments"]:
            segments.append({
                "start": segment["start"],
                "end": segment["end"],
                "text": segment["text"].strip(),
                "type": "other"  # Type will be classified by Node.js
            })
        
        # Create transcript data structure
        transcript_data = {
            "segments": segments,
            "metadata": {
                "totalDuration": result["segments"][-1]["end"] if segments else 0,
                "segmentCount": len(segments),
                "lastUpdated": datetime.now(timezone.utc).isoformat()
            }
        }
        
        # Only output the JSON to stdout
        print(json.dumps(transcript_data, ensure_ascii=False))
        return transcript_data
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Transcribe audio using Whisper")
    parser.add_argument("audio_path", help="Path to the audio file")
    parser.add_argument("--model", default="base", help="Whisper model to use (tiny, base, small, medium, large)")
    parser.add_argument("--output", help="Path to save the output JSON", default=None)
    
    args = parser.parse_args()
    
    try:
        print(f"Status: Processing audio file: {args.audio_path}", file=sys.stderr)
        transcript = transcribe_audio(args.audio_path, args.model)
        
        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                json.dump(transcript, f, ensure_ascii=False, indent=2)
            print(f"Status: Transcript saved to: {args.output}", file=sys.stderr)
            
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)
