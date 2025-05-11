# ARuco Marker Video Detector

A Python script for detecting ARuco markers in video files with real-time visualization and support for multiple ARuco dictionary types.

## Features

- Real-time ARuco marker detection from video files
- Support for multiple ARuco dictionary types (4x4, 5x5, 6x6, 7x7)
- Three operation modes:
  - Single dictionary detection
  - Automatic dictionary detection
  - Comprehensive testing of all dictionaries
- Real-time visualization of detected markers
- On-screen debug information overlay
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

The script can be run in three different modes:

### 1. Single Dictionary Mode
Use this when you know which dictionary your markers belong to:
```bash
python aruco_detector.py --video path/to/your/video.mp4 --dict DICT_4X4_50
```

### 2. Automatic Detection Mode (Default)
Use this to find the first dictionary that successfully detects markers:
```bash
python aruco_detector.py --video path/to/your/video.mp4
```

### 3. Comprehensive Testing Mode
Use this to test all available dictionaries and see which markers are detected by each:
```bash
python aruco_detector.py --video path/to/your/video.mp4 --test-all
```

Available dictionary options:
- 4x4 Markers:
  - `DICT_4X4_50`: 50 markers
  - `DICT_4X4_100`: 100 markers
  - `DICT_4X4_250`: 250 markers
  - `DICT_4X4_1000`: 1000 markers
- 5x5 Markers:
  - `DICT_5X5_50`: 50 markers
  - `DICT_5X5_100`: 100 markers
  - `DICT_5X5_250`: 250 markers
  - `DICT_5X5_1000`: 1000 markers
- 6x6 Markers:
  - `DICT_6X6_50`: 50 markers
  - `DICT_6X6_100`: 100 markers
  - `DICT_6X6_250`: 250 markers
  - `DICT_6X6_1000`: 1000 markers
- 7x7 Markers:
  - `DICT_7X7_50`: 50 markers
  - `DICT_7X7_100`: 100 markers
  - `DICT_7X7_250`: 250 markers
  - `DICT_7X7_1000`: 1000 markers
- Original ArUco:
  - `DICT_ARUCO_ORIGINAL`: Original ArUco markers (6x6)

## Interface

The script displays a single window with:

1. **Video Feed with Overlay**
   - Shows the processed video stream
   - Detected markers are highlighted with green rectangles
   - Marker IDs are displayed on the markers
   - Debug information is overlaid in the top-left corner

## Debug Information

The overlay shows:
- Number of markers detected
- Current dictionary being used
- Marker IDs found
- In --test-all mode: results from all dictionaries that found markers

## Controls

- Press 'q' to quit the application
- Window can be resized as needed (created with WINDOW_NORMAL flag)

## Tips

1. For best results, ensure:
   - Good lighting conditions in the video
   - Markers are clearly visible and not too small
   - Video resolution is sufficient to detect markers

2. When to use each mode:
   - Use `--dict` when you know your marker's dictionary
   - Use default mode for quick detection
   - Use `--test-all` when:
     - You're unsure which dictionary your markers use
     - You have multiple marker types in the scene
     - You want to verify marker detection across dictionaries

3. Performance considerations:
   - The script processes frames in real-time
   - Higher resolution videos may impact performance
   - `--test-all` mode is slower as it checks all dictionaries
   - Default mode stops at first successful detection

## Troubleshooting

1. If the video doesn't open:
   - Check if the video path is correct
   - Ensure the video file is not corrupted
   - Verify that OpenCV supports the video format

2. If markers aren't detected:
   - Try using `--test-all` to check all dictionaries
   - Verify that your markers match the dictionary specification
   - Check video quality and lighting

3. If the script crashes:
   - Ensure all dependencies are properly installed
   - Check if the video file is accessible
   - Verify Python and OpenCV versions are compatible

## License

This project is open source and available under the MIT License. 