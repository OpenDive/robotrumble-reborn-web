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
    for dict_name, aruco_dict in dictionaries.items():
        # Get marker size and count from dictionary name
        marker_size, marker_count = get_dictionary_info(dict_name)
        # Create the dictionary
        dictionary = aruco.Dictionary(aruco_dict, marker_size)
        # Detect markers with tuned parameters
        corners, ids, rejected = detect_markers_with_params(frame, dictionary)
        
        if ids is not None and len(ids) > 0:
            results.append((dict_name, corners, ids))
    
    return results

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
    cv2.namedWindow('Video Feed', cv2.WINDOW_NORMAL)

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        debug_lines = []
        frame_with_markers = frame.copy()

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
            
            if ids is not None and len(ids) > 0:
                frame_with_markers = aruco.drawDetectedMarkers(frame_with_markers, corners, ids)
                for corner in corners:
                    pts = corner.reshape((-1, 1, 2)).astype(np.int32)
                    cv2.polylines(frame_with_markers, [pts], True, (0, 255, 0), 2)
                debug_lines.append((f"Dictionary {args.dict}: {len(ids)} markers", (0, 255, 0)))
                debug_lines.append((f"Marker IDs: {', '.join(str(id[0]) for id in ids)}", (0, 255, 0)))
            else:
                debug_lines.append((f"No markers found with {args.dict}", (0, 0, 255)))

        elif args.test_all:
            # Test all dictionaries
            results = test_all_dictionaries(frame, ARUCO_DICTS)
            if results:
                debug_lines.append(("Found markers in these dictionaries:", (255, 255, 255)))
                for dict_name, corners, ids in results:
                    frame_with_markers = aruco.drawDetectedMarkers(frame_with_markers, corners, ids)
                    for corner in corners:
                        pts = corner.reshape((-1, 1, 2)).astype(np.int32)
                        cv2.polylines(frame_with_markers, [pts], True, (0, 255, 0), 2)
                    debug_lines.append((f"{dict_name}: {len(ids)} markers - IDs: {', '.join(str(id[0]) for id in ids)}", 
                                      (0, 255, 0)))
            else:
                debug_lines.append(("No markers found in any dictionary", (0, 0, 255)))
        else:
            # Find first dictionary with markers
            corners, ids, current_dict, dictionary = find_first_marker(frame, ARUCO_DICTS)
            if ids is not None and len(ids) > 0:
                frame_with_markers = aruco.drawDetectedMarkers(frame_with_markers, corners, ids)
                for corner in corners:
                    pts = corner.reshape((-1, 1, 2)).astype(np.int32)
                    cv2.polylines(frame_with_markers, [pts], True, (0, 255, 0), 2)
                debug_lines.append((f"Dictionary {current_dict}: {len(ids)} markers", (0, 255, 0)))
                debug_lines.append((f"Marker IDs: {', '.join(str(id[0]) for id in ids)}", (0, 255, 0)))
            else:
                debug_lines.append(("No markers found in any dictionary", (0, 0, 255)))

        # Add debug overlay
        add_debug_overlay(frame_with_markers, debug_lines)

        # Show frame
        cv2.imshow('Video Feed', frame_with_markers)

        # Break loop on 'q' press
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main() 