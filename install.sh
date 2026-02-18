#!/bin/bash
# Installation script for Minecraft Server Manager

echo "========================================="
echo "Minecraft Server Manager - Installation"
echo "========================================="
echo ""

# Check for Python 3
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed."
    echo "Please install Python 3.6 or higher and try again."
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo "✓ Found Python $PYTHON_VERSION"

# Check for Java
if ! command -v java &> /dev/null; then
    echo "WARNING: Java is not installed."
    echo "Java is required to run Minecraft servers."
    echo "Please install Java to run servers."
else
    JAVA_VERSION=$(java -version 2>&1 | head -n 1)
    echo "✓ Found $JAVA_VERSION"
fi

# Install Python dependencies
echo ""
echo "Installing Python dependencies..."
pip3 install -r requirements.txt

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install dependencies."
    exit 1
fi

echo "✓ Dependencies installed successfully"

# Make CLI tool executable
chmod +x mcm
chmod +x web.py

echo "✓ Made CLI tool executable"

# Create config file if it doesn't exist
if [ ! -f config.json ]; then
    echo ""
    echo "Creating default configuration file..."
    cp config.example.json config.json
    echo "✓ Created config.json from example"
    echo ""
    echo "IMPORTANT: Please edit config.json to configure your servers"
fi

# Create directories
mkdir -p servers backups

echo ""
echo "========================================="
echo "Installation complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Edit config.json to add your servers"
echo "2. Start the web interface: python3 web.py"
echo "3. Or use the CLI tool: ./mcm list"
echo ""
echo "For more information, see README.md"
echo ""
