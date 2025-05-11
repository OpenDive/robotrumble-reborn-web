#!/usr/bin/env python3

import cv2
import numpy as np
import argparse
from cv2 import aruco
import sys

def get_dictionary_info(dict_name):
    """Extract marker size and number from dictionary name."""
    # Format is DICT_<SIZE>X<SIZE>_<COUNT>
    parts = dict_name.split('_')
    size = int(parts[1][0])  # Extract size (4,5,6,7)
    count = int(parts[2])    # Extract count (50,100,250,etc)
    return size, count

def find_marker_in_dictionaries(frame, dictionaries):
    """Try to detect markers using different ArUco dictionaries."""
    for dict_name, aruco_dict in dictionaries.items():
        # Get marker size and count from dictionary name
        marker_size, marker_count = get_dictionary_info(dict_name)
        # Create the dictionary
        dictionary = aruco.Dictionary(aruco_dict, marker_size)
        # Define detection parameters
        parameters = aruco.DetectorParameters()
        
        # Create detector
        detector = aruco.ArucoDetector(dictionary, parameters)
        
        # Detect markers
        corners, ids, rejected = detector.detectMarkers(frame)
        
        if ids is not None:
            return corners, ids, dict_name, dictionary
    
    return None, None, None, None

def main():
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description='ARuco Marker Detection from Video')
    parser.add_argument('--video', type=str, required=True, help='Path to the video file')
    parser.add_argument('--dict', type=str, help='ArUco dictionary to use (e.g., DICT_4X4_50)')
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

    # Create windows
    cv2.namedWindow('Video Feed', cv2.WINDOW_NORMAL)
    cv2.namedWindow('Debug Info', cv2.WINDOW_NORMAL)

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        debug_frame = np.zeros((200, 400, 3), dtype=np.uint8)  # Debug window
        
        if args.dict:
            # Use specified dictionary
            if args.dict not in ARUCO_DICTS:
                print(f"Error: Unknown dictionary {args.dict}")
                print(f"Available dictionaries: {', '.join(ARUCO_DICTS.keys())}")
                sys.exit(1)
            
            # Get marker size from dictionary name
            marker_size, _ = get_dictionary_info(args.dict)
            dictionary = aruco.Dictionary(ARUCO_DICTS[args.dict], marker_size)
            parameters = aruco.DetectorParameters()
            detector = aruco.ArucoDetector(dictionary, parameters)
            corners, ids, rejected = detector.detectMarkers(frame)
            current_dict = args.dict
        else:
            # Try all dictionaries
            corners, ids, current_dict, dictionary = find_marker_in_dictionaries(frame, ARUCO_DICTS)

        # Update debug window
        debug_frame.fill(0)
        if ids is not None:
            # Draw markers on the frame
            frame = aruco.drawDetectedMarkers(frame, corners, ids)
            
            # Draw green rectangle around markers
            for corner in corners:
                pts = corner.reshape((-1, 1, 2)).astype(np.int32)
                cv2.polylines(frame, [pts], True, (0, 255, 0), 2)

            # Update debug info
            cv2.putText(debug_frame, f"Markers Found: {len(ids)}", (10, 30),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            cv2.putText(debug_frame, f"Dictionary: {current_dict}", (10, 60),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        else:
            cv2.putText(debug_frame, "No Markers Found", (10, 30),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            cv2.putText(debug_frame, f"Dictionary: {current_dict if current_dict else 'Searching...'}", 
                       (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

        # Show frames
        cv2.imshow('Video Feed', frame)
        cv2.imshow('Debug Info', debug_frame)

        # Break loop on 'q' press
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main() 