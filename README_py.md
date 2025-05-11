# ARuco Marker Video Detector

A Python script for detecting ARuco markers in video files with real-time visualization and support for multiple ARuco dictionary types.

## Features

- Real-time ARuco marker detection from video files
- Support for multiple ARuco dictionary types (4x4, 5x5, 6x6, 7x7)
- Automatic dictionary detection mode
- Real-time visualization of detected markers
- Debug window showing detection status
- Command-line interface for easy usage
- Visual feedback with marker highlighting

## Prerequisites

- Python 3.6 or higher
- OpenCV with contrib modules
- NumPy

## Installation

1. Create and activate a virtual environment (recommended):
   ```bash
   # Create virtual environment
   python -m venv venv

   # Activate on Unix/macOS
   source venv/bin/activate

   # Activate on Windows
   venv\Scripts\activate
   ```

2. Install required packages:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

The script can be run in two modes:

### 1. Automatic Dictionary Detection Mode

```bash
python aruco_detector.py --video path/to/your/video.mp4
```

In this mode, the script will automatically try different ARuco dictionaries to find markers in each frame.

### 2. Specific Dictionary Mode

```bash
python aruco_detector.py --video path/to/your/video.mp4 --dict DICT_4X4_50
```

Available dictionary options:
- `DICT_4X4_50`: 4x4 markers, dictionary of 50 markers
- `DICT_4X4_100`: 4x4 markers, dictionary of 100 markers
- `DICT_5X5_50`: 5x5 markers, dictionary of 50 markers
- `DICT_5X5_100`: 5x5 markers, dictionary of 100 markers
- `DICT_6X6_50`: 6x6 markers, dictionary of 50 markers
- `DICT_6X6_100`: 6x6 markers, dictionary of 100 markers
- `DICT_7X7_50`: 7x7 markers, dictionary of 50 markers
- `DICT_7X7_100`: 7x7 markers, dictionary of 100 markers

## Interface

The script displays two windows:

1. **Video Feed Window**
   - Shows the processed video stream
   - Detected markers are highlighted with green rectangles
   - Marker IDs are displayed on the markers

2. **Debug Info Window**
   - Shows the number of markers currently detected
   - Displays the current dictionary being used
   - Shows detection status (found/not found)

## Controls

- Press 'q' to quit the application
- Windows can be resized as needed (they are created with WINDOW_NORMAL flag)

## Visual Feedback

- Green rectangles indicate detected markers
- Marker IDs are displayed on the markers
- Red text in debug window indicates no markers found
- Green text indicates successful detection

## Tips

1. For best results, ensure:
   - Good lighting conditions in the video
   - Markers are clearly visible and not too small
   - Video resolution is sufficient to detect markers

2. If markers are not being detected:
   - Try different dictionary types
   - Check if the markers in your video match the dictionary type
   - Ensure the video quality is good enough for detection

3. Performance considerations:
   - The script processes frames in real-time
   - Higher resolution videos may impact performance
   - Automatic dictionary detection mode may be slower than specific dictionary mode

## Troubleshooting

1. If the video doesn't open:
   - Check if the video path is correct
   - Ensure the video file is not corrupted
   - Verify that OpenCV supports the video format

2. If markers aren't detected:
   - Try different dictionary types
   - Verify that your markers match the dictionary specification
   - Check video quality and lighting

3. If the script crashes:
   - Ensure all dependencies are properly installed
   - Check if the video file is accessible
   - Verify Python and OpenCV versions are compatible

## License

This project is open source and available under the MIT License. 