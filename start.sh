#!/bin/bash
set -e

# Go into the Next.js app directory
cd rcl-portal

# Install dependencies
npm install

# Build the Next.js app
npm run build

# Start the production server
npm start
