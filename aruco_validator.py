#!/usr/bin/env python3
import cv2
import numpy as np
import argparse
from pathlib import Path
import json
from datetime import datetime

def create_debug_window(frame):
    """Create a debug window with original frame and processed binary image"""
    height, width = frame.shape[:2]
    debug_frame = np.zeros((height, width * 2, 3), dtype=np.uint8)
    # Original frame on the left
    debug_frame[:, :width] = frame
    return debug_frame, width

def process_video(video_path, dictionary_name="DICT_6X6_250", show_video=True):
    """Process video file and detect ArUco markers"""
    # Get ArUco dictionary
    ARUCO_DICT = {
        "DICT_4X4_50": cv2.aruco.DICT_4X4_50,
        "DICT_4X4_100": cv2.aruco.DICT_4X4_100,
        "DICT_5X5_50": cv2.aruco.DICT_5X5_50,
        "DICT_5X5_100": cv2.aruco.DICT_5X5_100,
        "DICT_6X6_50": cv2.aruco.DICT_6X6_50,
        "DICT_6X6_100": cv2.aruco.DICT_6X6_100,
        "DICT_6X6_250": cv2.aruco.DICT_6X6_250,
        "DICT_7X7_50": cv2.aruco.DICT_7X7_50,
        "DICT_7X7_100": cv2.aruco.DICT_7X7_100,
        "DICT_ARUCO_ORIGINAL": cv2.aruco.DICT_ARUCO_ORIGINAL
    }

    if dictionary_name not in ARUCO_DICT:
        raise ValueError(f"ArUco dictionary {dictionary_name} not found")

    # Initialize detector with parameters
    aruco_dict = cv2.aruco.getPredefinedDictionary(ARUCO_DICT[dictionary_name])
    parameters = cv2.aruco.DetectorParameters()
    
    # Adjust detection parameters
    parameters.adaptiveThreshWinSizeMin = 3
    parameters.adaptiveThreshWinSizeMax = 23
    parameters.adaptiveThreshWinSizeStep = 10
    parameters.adaptiveThreshConstant = 7
    parameters.minMarkerPerimeterRate = 0.03
    parameters.maxMarkerPerimeterRate = 0.4
    parameters.polygonalApproxAccuracyRate = 0.03
    parameters.cornerRefinementMethod = cv2.aruco.CORNER_REFINE_SUBPIX
    parameters.cornerRefinementWinSize = 5
    parameters.cornerRefinementMaxIterations = 30
    parameters.cornerRefinementMinAccuracy = 0.1
    parameters.minCornerDistanceRate = 0.05
    parameters.minDistanceToBorder = 3
    parameters.minMarkerDistanceRate = 0.05
    parameters.maxErroneousBitsInBorderRate = 0.35
    parameters.errorCorrectionRate = 0.6

    detector = cv2.aruco.ArucoDetector(aruco_dict, parameters)

    # Open video file
    video = cv2.VideoCapture(str(video_path))
    if not video.isOpened():
        raise ValueError(f"Could not open video file: {video_path}")

    # Get video properties
    fps = video.get(cv2.CAP_PROP_FPS)
    frame_count = int(video.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(video.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(video.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Statistics
    stats = {
        "video_info": {
            "path": str(video_path),
            "fps": fps,
            "frame_count": frame_count,
            "width": width,
            "height": height,
            "dictionary": dictionary_name
        },
        "frames": [],
        "summary": {
            "total_frames": 0,
            "frames_with_markers": 0,
            "total_markers_detected": 0,
            "marker_ids_found": set()
        }
    }

    # Create windows for parameter adjustment if showing video
    if show_video:
        cv2.namedWindow('Parameters')
        cv2.createTrackbar('Contrast', 'Parameters', 100, 200, lambda x: None)
        cv2.createTrackbar('Brightness', 'Parameters', 100, 200, lambda x: None)
        cv2.createTrackbar('Blur', 'Parameters', 0, 20, lambda x: None)
        cv2.createTrackbar('Block Size', 'Parameters', 11, 99, lambda x: None)
        cv2.createTrackbar('C', 'Parameters', 2, 20, lambda x: None)

    frame_number = 0
    while True:
        ret, frame = video.read()
        if not ret:
            break

        frame_number += 1
        frame_stats = {
            "frame_number": frame_number,
            "timestamp": frame_number / fps,
            "markers_detected": []
        }

        # Get parameters from trackbars if showing video
        if show_video:
            contrast = cv2.getTrackbarPos('Contrast', 'Parameters') / 100.0
            brightness = cv2.getTrackbarPos('Brightness', 'Parameters') - 100
            blur_size = cv2.getTrackbarPos('Blur', 'Parameters') * 2 + 1
            block_size = cv2.getTrackbarPos('Block Size', 'Parameters') * 2 + 1
            c_value = cv2.getTrackbarPos('C', 'Parameters')
        else:
            contrast, brightness = 1.0, 0
            blur_size, block_size, c_value = 1, 11, 2

        # Image preprocessing
        # 1. Adjust contrast and brightness
        processed = cv2.convertScaleAbs(frame, alpha=contrast, beta=brightness)
        
        # 2. Convert to grayscale
        gray = cv2.cvtColor(processed, cv2.COLOR_BGR2GRAY)
        
        # 3. Apply Gaussian blur if blur_size > 1
        if blur_size > 1:
            gray = cv2.GaussianBlur(gray, (blur_size, blur_size), 0)
        
        # 4. Apply adaptive thresholding
        binary = cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            block_size,
            c_value
        )

        # Create debug visualization
        debug_frame = np.zeros((height, width * 3, 3), dtype=np.uint8)
        debug_frame[:, :width] = frame  # Original
        debug_frame[:, width:width*2] = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)  # Grayscale
        debug_frame[:, width*2:] = cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)  # Binary

        # Detect markers
        corners, ids, rejected = detector.detectMarkers(gray)

        # Process detection results
        if ids is not None:
            stats["summary"]["frames_with_markers"] += 1
            stats["summary"]["total_markers_detected"] += len(ids)
            stats["summary"]["marker_ids_found"].update([int(id_) for id_ in ids.flatten()])

            # Draw detection results on all views
            for i in range(3):
                cv2.aruco.drawDetectedMarkers(
                    debug_frame[:, i*width:(i+1)*width],
                    corners,
                    ids,
                    (0, 255, 0)
                )

            # Store marker details
            for i, (marker_corners, marker_id) in enumerate(zip(corners, ids.flatten())):
                frame_stats["markers_detected"].append({
                    "id": int(marker_id),
                    "corners": marker_corners.tolist()
                })

        # Draw rejected candidates if any
        if rejected is not None and len(rejected) > 0:
            for i in range(3):
                cv2.aruco.drawDetectedMarkers(
                    debug_frame[:, i*width:(i+1)*width],
                    rejected,
                    None,
                    (0, 0, 255)
                )

        # Add frame stats
        stats["frames"].append(frame_stats)
        stats["summary"]["total_frames"] = frame_number

        # Show debug visualization
        if show_video:
            # Add text overlay
            cv2.putText(debug_frame, "Original", (10, 30),
                       cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            cv2.putText(debug_frame, "Grayscale", (width + 10, 30),
                       cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            cv2.putText(debug_frame, "Binary", (width*2 + 10, 30),
                       cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            
            cv2.putText(debug_frame, f"Frame: {frame_number}/{frame_count}", (10, 70),
                       cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            cv2.putText(debug_frame, f"Markers: {len(ids) if ids is not None else 0}", (10, 110),
                       cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            if rejected is not None:
                cv2.putText(debug_frame, f"Rejected: {len(rejected)}", (10, 150),
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

            cv2.imshow("ArUco Validation", debug_frame)
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                break

    # Clean up
    video.release()
    if show_video:
        cv2.destroyAllWindows()

    # Convert set to list for JSON serialization
    stats["summary"]["marker_ids_found"] = list(stats["summary"]["marker_ids_found"])

    return stats

def save_stats(stats, output_dir):
    """Save detection statistics to a JSON file"""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = output_dir / f"aruco_validation_{timestamp}.json"

    with open(output_file, 'w') as f:
        json.dump(stats, f, indent=2)

    print(f"Statistics saved to: {output_file}")
    
    # Print summary
    print("\nDetection Summary:")
    print(f"Total frames processed: {stats['summary']['total_frames']}")
    print(f"Frames with markers: {stats['summary']['frames_with_markers']}")
    print(f"Total markers detected: {stats['summary']['total_markers_detected']}")
    print(f"Unique marker IDs found: {stats['summary']['marker_ids_found']}")

def main():
    parser = argparse.ArgumentParser(description="Validate ArUco marker detection in video files")
    parser.add_argument("video_path", help="Path to the video file")
    parser.add_argument("--dictionary", default="DICT_6X6_250",
                      help="ArUco dictionary to use (default: DICT_6X6_250)")
    parser.add_argument("--no-video", action="store_true",
                      help="Don't show video playback")
    parser.add_argument("--output-dir", default="validation_results",
                      help="Directory to save results (default: validation_results)")

    args = parser.parse_args()

    try:
        stats = process_video(args.video_path, args.dictionary, not args.no_video)
        save_stats(stats, args.output_dir)
    except Exception as e:
        print(f"Error: {e}")
        return 1

    return 0

if __name__ == "__main__":
    exit(main()) 