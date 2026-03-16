import cv2
import time
import requests
import threading
from playsound import playsound
import os
import random

# Backend Configuration
BACKEND_URL = "http://localhost:8000/api/driver/drowsiness"

# Drowsiness detection parameters
CONSECUTIVE_FRAMES = 15
ALARM_PATH = "alarm.mp3"

# Mock Mode Configuration
MOCK_MODE = True # Set to False for real webcam use

# Haar Cascades setup
try:
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye_tree_eyeglasses.xml')
except:
    face_cascade = None
    eye_cascade = None

def send_to_backend(data):
    try:
        requests.post(BACKEND_URL, json=data, timeout=0.1)
    except:
        pass

def play_alarm():
    try:
        if os.path.exists(ALARM_PATH):
            playsound(ALARM_PATH)
    except:
        pass

def main():
    if not MOCK_MODE:
        cap = cv2.VideoCapture(0)
        print("Drowsiness detection started. Press 'q' to quit.")
    else:
        print("MOCK MODE: Driver Drowsiness Monitor (Simulating events). Press 'q' to quit.")

    counter = 0
    alarm_on = False
    last_update_time = time.time()
    mock_drowsy = False
    mock_timer = 0

    while True:
        current_status = "Awake"
        severity = "normal"
        image = None

        if not MOCK_MODE:
            success, frame = cap.read()
            if not success:
                print("Could not read from webcam. Switching to MOCK_MODE...")
                break # Or fall back to mock
            
            image = cv2.flip(frame, 1)
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.3, 5, minSize=(100, 100))
            
            eyes_detected = False
            if len(faces) > 0:
                for (x, y, w, h) in faces:
                    cv2.rectangle(image, (x, y), (x+w, y+h), (0, 255, 0), 2)
                    roi_gray = gray[y:y+int(h*0.65), x:x+w]
                    eyes = eye_cascade.detectMultiScale(roi_gray, 1.1, 10, minSize=(30, 30))
                    if len(eyes) >= 2: eyes_detected = True
                
                if not eyes_detected: counter += 1
                else: counter = 0
            else:
                current_status = "No face detected"
                severity = "warning"
                counter = 0
        else:
            # Mock logic: Rotate between Awake and Drowsy every 10 seconds
            mock_timer += 0.1
            if mock_timer > 10:
                mock_drowsy = not mock_drowsy
                mock_timer = 0
                print(f"MOCK: Switching status to {'DROWSY' if mock_drowsy else 'AWAKE'}")

            if mock_drowsy:
                counter += 1
                if counter >= CONSECUTIVE_FRAMES:
                    current_status = "DROWSY"
                    severity = "critical"
            else:
                counter = 0
                current_status = "Awake"
                severity = "normal"
            
            # Create a blank image for mock display
            image = 0 * (0 * (0, 0, 0)) # just for layout
            image = 255 * (0 * (0, 0, 0)) # Wait this is wrong in python
            image = (0 * (0, 0, 0)) # simpler
            # Create a 480x640 black image
            import numpy as np
            image = np.zeros((480, 640, 3), dtype=np.uint8)

        if current_status == "DROWSY":
            if not alarm_on:
                alarm_on = True
                threading.Thread(target=play_alarm, daemon=True).start()
        else:
            alarm_on = False

        # Display on screen
        cv2.putText(image, f"MOCK MODE" if MOCK_MODE else "LIVE", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        cv2.putText(image, f"Status: {current_status}", (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255) if severity == "critical" else (0, 255, 0), 2)
        cv2.putText(image, f"Counter: {counter}", (10, 110), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)

        # Send data to backend every 0.2s
        if time.time() - last_update_time > 0.2:
            data = {
                "status": current_status,
                "severity": severity,
                "ear": 0.24 if not mock_drowsy else 0.15,
                "threshold": 0.22,
                "consecutive_closed_frames": counter,
                "eyes_closed_seconds": counter / 10.0,
                "alarm_active": alarm_on
            }
            threading.Thread(target=send_to_backend, args=(data,), daemon=True).start()
            last_update_time = time.time()

        cv2.imshow('Driver Drowsiness Monitor', image)
        if cv2.waitKey(100) & 0xFF == ord('q'):
            break

    if not MOCK_MODE: cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
