#!/usr/bin/env python3

import cv2
import numpy as np
import argparse
from cv2 import aruco
import sys

def get_dictionary_info(dict_name):
    """Extract marker size and number from dictionary name."""
    # Special case for DICT_ARUCO_ORIGINAL
    if dict_name == 'DICT_ARUCO_ORIGINAL':
        return 6, 1024  # Original ArUco markers are 6x6

    # Format is DICT_<SIZE>X<SIZE>_<COUNT>
    parts = dict_name.split('_')
    size = int(parts[1][0])  # Extract size (4,5,6,7)
    count = int(parts[2])    # Extract count (50,100,250,etc)
    return size, count

def add_debug_overlay(frame, text_lines, start_y=30, line_height=30):
    """Add debug information as overlay on the frame."""
    # Add semi-transparent black background for better text visibility
    overlay = frame.copy()
    bg_height = (len(text_lines) + 1) * line_height
    cv2.rectangle(overlay, (10, 10), (400, 10 + bg_height), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.5, frame, 0.5, 0, frame)

    # Add text lines
    for i, (text, color) in enumerate(text_lines):
        y_pos = start_y + (i * line_height)
        cv2.putText(frame, text, (20, y_pos),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

def get_debug_color(dict_index):
    """Get a unique color for each dictionary."""
    colors = [
        (0, 255, 0),    # Green
        (255, 0, 0),    # Blue
        (0, 0, 255),    # Red
        (255, 255, 0),  # Cyan
        (255, 0, 255),  # Magenta
        (0, 255, 255),  # Yellow
    ]
    return colors[dict_index % len(colors)]

def create_debug_visualization(frame, corners, ids, rejected, dict_name, dict_index):
    """Create debug visualization for a single dictionary detection."""
    debug_frame = frame.copy()
    
    # Convert to grayscale for threshold visualization
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # Apply adaptive threshold (similar to what ArUco detector uses)
    thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C,
                                 cv2.THRESH_BINARY_INV, 23, 7)
    
    # Convert threshold back to BGR for visualization
    thresh_bgr = cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)
    
    # Draw detected markers with unique color
    color = get_debug_color(dict_index)
    if ids is not None:
        debug_frame = aruco.drawDetectedMarkers(debug_frame, corners, ids, color)
    
    # Draw rejected candidates in red
    if rejected is not None and len(rejected) > 0:
        debug_frame = aruco.drawDetectedMarkers(debug_frame, rejected, None, (0, 0, 255))
    
    # Add dictionary name
    cv2.putText(debug_frame, dict_name, (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
    
    return debug_frame, thresh_bgr

def filter_duplicate_detections(corners, ids, min_distance=10):
    """Filter out duplicate marker detections that are too close to each other."""
    if ids is None or len(ids) == 0:
        return corners, ids
    
    # Convert corners to centers
    centers = []
    for corner in corners:
        center = np.mean(corner[0], axis=0)
        centers.append(center)
    centers = np.array(centers)
    
    # Keep track of which detections to keep
    keep = np.ones(len(ids), dtype=bool)
    
    # Compare each detection with all others
    for i in range(len(ids)):
        if not keep[i]:
            continue
        for j in range(i + 1, len(ids)):
            if not keep[j]:
                continue
            # Calculate distance between centers
            dist = np.linalg.norm(centers[i] - centers[j])
            if dist < min_distance:
                # Keep the one with larger perimeter (likely more accurate)
                perimeter1 = cv2.arcLength(corners[i][0], True)
                perimeter2 = cv2.arcLength(corners[j][0], True)
                if perimeter1 > perimeter2:
                    keep[j] = False
                else:
                    keep[i] = False
                    break
    
    # Filter corners and ids
    filtered_corners = [corners[i] for i in range(len(corners)) if keep[i]]
    filtered_ids = ids[keep]
    
    return filtered_corners, filtered_ids

def detect_markers_with_params(frame, dictionary, parameters=None):
    """Detect markers with optional parameter tuning."""
    if parameters is None:
        parameters = aruco.DetectorParameters()
    
    # Tune detection parameters for better pattern recognition
    parameters.adaptiveThreshWinSizeMin = 7  # Increased from 3
    parameters.adaptiveThreshWinSizeMax = 23
    parameters.adaptiveThreshWinSizeStep = 4  # Decreased for finer control
    parameters.adaptiveThreshConstant = 7
    
    # Make the detector more strict about marker shape and size
    parameters.minMarkerPerimeterRate = 0.05  # Increased minimum size
    parameters.maxMarkerPerimeterRate = 0.5   # Allow larger markers
    parameters.polygonalApproxAccuracyRate = 0.05  # More strict corner detection
    parameters.minCornerDistanceRate = 0.05
    
    # Increase minimum distance between markers to avoid detecting parts of the same marker
    parameters.minMarkerDistanceRate = 0.1
    
    # More strict border detection
    parameters.minDistanceToBorder = 5
    
    # Make the detector more strict about the black border around markers
    parameters.perspectiveRemovePixelPerCell = 8
    parameters.perspectiveRemoveIgnoredMarginPerCell = 0.4
    
    # Increase accuracy requirements
    parameters.errorCorrectionRate = 0.6  # Require more accurate bit reading
    parameters.minOtsuStdDev = 5.0  # Minimum standard deviation for adaptive thresholding
    parameters.minMarkerDistanceRate = 0.1  # Minimum distance between markers
    
    # Create detector with parameters
    detector = aruco.ArucoDetector(dictionary, parameters)
    
    # Detect markers
    corners, ids, rejected = detector.detectMarkers(frame)
    
    # Filter out duplicate detections
    if corners and ids is not None:
        corners, ids = filter_duplicate_detections(corners, ids, min_distance=20)  # Increased min_distance
    
    return corners, ids, rejected

def test_all_dictionaries(frame, dictionaries):
    """Test all dictionaries and return results for each."""
    results = []
    debug_frames = []
    thresh_frames = []
    
    for i, (dict_name, aruco_dict) in enumerate(dictionaries.items()):
        # Get marker size and count from dictionary name
        marker_size, marker_count = get_dictionary_info(dict_name)
        # Create the dictionary
        dictionary = aruco.Dictionary(aruco_dict, marker_size)
        # Detect markers with tuned parameters
        corners, ids, rejected = detect_markers_with_params(frame, dictionary)
        
        # Create debug visualization
        debug_frame, thresh_frame = create_debug_visualization(
            frame, corners, ids, rejected, dict_name, i)
        debug_frames.append(debug_frame)
        thresh_frames.append(thresh_frame)
        
        if ids is not None and len(ids) > 0:
            results.append((dict_name, corners, ids))
    
    return results, debug_frames, thresh_frames

def find_first_marker(frame, dictionaries):
    """Find first dictionary that detects any marker."""
    for dict_name, aruco_dict in dictionaries.items():
        # Get marker size and count from dictionary name
        marker_size, marker_count = get_dictionary_info(dict_name)
        # Create the dictionary
        dictionary = aruco.Dictionary(aruco_dict, marker_size)
        # Detect markers with tuned parameters
        corners, ids, rejected = detect_markers_with_params(frame, dictionary)
        
        if ids is not None and len(ids) > 0:
            return corners, ids, dict_name, dictionary
    
    return None, None, None, None

def create_side_by_side_view(frame, corners, ids, dict_name, all_results=None):
    """Create a side by side view of original frame and threshold."""
    # Get frame dimensions
    height, width = frame.shape[:2]
    
    # Convert to grayscale for threshold
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # Apply adaptive threshold
    thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C,
                                 cv2.THRESH_BINARY_INV, 23, 7)
    
    # Convert threshold back to BGR for visualization
    thresh_bgr = cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)
    
    # Create the side-by-side view
    combined = np.zeros((height, width * 2, 3), dtype=np.uint8)
    
    # Copy original frame with detections to left side
    frame_with_markers = frame.copy()
    
    if all_results:
        # Draw markers from all dictionaries with different colors
        for idx, (dict_name, dict_corners, dict_ids) in enumerate(all_results):
            color = get_debug_color(idx)
            if dict_ids is not None:
                frame_with_markers = aruco.drawDetectedMarkers(frame_with_markers, dict_corners, dict_ids, color)
    elif ids is not None:
        frame_with_markers = aruco.drawDetectedMarkers(frame_with_markers, corners, ids)
    
    combined[:, :width] = frame_with_markers
    combined[:, width:] = thresh_bgr
    
    # Add labels
    cv2.putText(combined, "Original + Detections", (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
    cv2.putText(combined, "Threshold View", (width + 10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
    
    # Add detection info
    y_offset = 70
    if all_results:
        for idx, (dict_name, dict_corners, dict_ids) in enumerate(all_results):
            color = get_debug_color(idx)
            if dict_ids is not None and len(dict_ids) > 0:
                dict_text = f"{dict_name}: {len(dict_ids)} markers - IDs: {', '.join(str(id[0]) for id in dict_ids)}"
                cv2.putText(combined, dict_text, (10, y_offset),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
                y_offset += 30
    elif ids is not None:
        cv2.putText(combined, f"{dict_name}: {len(ids)} markers", (10, y_offset),
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        id_text = f"IDs: {', '.join(str(id[0]) for id in ids)}"
        cv2.putText(combined, id_text, (10, y_offset + 40),
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
    else:
        cv2.putText(combined, f"No markers found", (10, y_offset),
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
    
    return combined

def main():
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description='ARuco Marker Detection from Video')
    parser.add_argument('--video', type=str, required=True, help='Path to the video file')
    parser.add_argument('--dict', type=str, help='ArUco dictionary to use (e.g., DICT_4X4_50)')
    parser.add_argument('--test-all', action='store_true', help='Test all dictionaries and show all detected markers')
    args = parser.parse_args()

    # Available ArUco dictionaries
    ARUCO_DICTS = {
        'DICT_4X4_50': aruco.DICT_4X4_50,
        'DICT_4X4_100': aruco.DICT_4X4_100,
        'DICT_4X4_250': aruco.DICT_4X4_250,
        'DICT_4X4_1000': aruco.DICT_4X4_1000,
        'DICT_5X5_50': aruco.DICT_5X5_50,
        'DICT_5X5_100': aruco.DICT_5X5_100,
        'DICT_5X5_250': aruco.DICT_5X5_250,
        'DICT_5X5_1000': aruco.DICT_5X5_1000,
        'DICT_6X6_50': aruco.DICT_6X6_50,
        'DICT_6X6_100': aruco.DICT_6X6_100,
        'DICT_6X6_250': aruco.DICT_6X6_250,
        'DICT_6X6_1000': aruco.DICT_6X6_1000,
        'DICT_7X7_50': aruco.DICT_7X7_50,
        'DICT_7X7_100': aruco.DICT_7X7_100,
        'DICT_7X7_250': aruco.DICT_7X7_250,
        'DICT_7X7_1000': aruco.DICT_7X7_1000,
        'DICT_ARUCO_ORIGINAL': aruco.DICT_ARUCO_ORIGINAL,
    }

    # Open video capture
    cap = cv2.VideoCapture(args.video)
    if not cap.isOpened():
        print(f"Error: Could not open video file {args.video}")
        sys.exit(1)

    # Create window
    cv2.namedWindow('ArUco Detector Debug', cv2.WINDOW_NORMAL)

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if args.dict:
            # Use specified dictionary
            if args.dict not in ARUCO_DICTS:
                print(f"Error: Unknown dictionary {args.dict}")
                print(f"Available dictionaries: {', '.join(ARUCO_DICTS.keys())}")
                sys.exit(1)
            
            # Get marker size from dictionary name
            marker_size, _ = get_dictionary_info(args.dict)
            dictionary = aruco.Dictionary(ARUCO_DICTS[args.dict], marker_size)
            corners, ids, rejected = detect_markers_with_params(frame, dictionary)
            
            # Create side by side view
            debug_view = create_side_by_side_view(frame, corners, ids, args.dict)
            
        elif args.test_all:
            # Test all dictionaries
            results, debug_frames, thresh_frames = test_all_dictionaries(frame, ARUCO_DICTS)
            
            # Create side by side view with all results
            debug_view = create_side_by_side_view(frame, None, None, None, all_results=results)

        # Show the combined view
        cv2.imshow('ArUco Detector Debug', debug_view)

        # Break loop on 'q' press
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main() 