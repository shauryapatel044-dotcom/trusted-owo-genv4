#!/bin/bash

# Status: Installing npm dependencies...
echo "[Status] Installing npm dependencies..."
npm i
if [ $? -ne 0 ]; then
    echo -e "\n[Error] Failed to install dependencies."
    read -p "Press enter to continue..."
    exit 1
fi

clear

# Status: Running AutoCaptcha.py...
echo "[Status] Running AutoCaptcha.py..."
python3 AutoCaptcha.py
if [ $? -ne 0 ]; then
    echo -e "\n[Warning] AutoCaptcha.py failed (continuing anyway)..."
    sleep 3
fi

clear

# Status: Starting Tool...
echo "[Status] Starting Tool..."
npm start
if [ $? -ne 0 ]; then
    echo -e "\n[Error] Failed to start the tool."
    read -p "Press enter to continue..."
    exit 1
fi
