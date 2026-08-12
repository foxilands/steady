# Steady

Steady is a lightweight personal utility app for tracking daily pouch usage, spending, and timer habits. It is built with Expo and React Native and is designed to run as a private, local-first tool with no backend dependency.

## Overview

Steady helps a user:

- track the number of pouches used in a day
- compare usage against a personal limit
- estimate cost based on can size and price
- monitor a reminder timer while using the app
- review the last 7 days and a monthly/quincena-style calendar view

## Features

- local-only persistence with AsyncStorage
- timer tracking and reminder-style workflow
- daily limit and cost calculation
- recent history and calendar summaries
- Android-ready Expo setup with EAS build support

## Tech Stack

- Expo SDK 53
- React Native 0.79.6
- React 19
- Expo EAS for Android builds
- AsyncStorage for local persistence

## Project Status

This repository represents the final Steady app configuration used for the successful Android preview build.

## Local Setup

```bash
npm install
npx expo start
```

## Android Preview Build

```bash
npx eas build --profile preview --platform android
```

## Production Build Notes

The project is configured for Expo EAS builds. The current preview app profile is set for Android APK builds, and the app is ready for further release preparation if a production package is required.

## Security and Privacy Notes

- The app stores its data locally on-device.
- There is no remote API or backend connection in the current app flow.
- No secrets or credentials are embedded in the app source.
- This keeps the app well-suited for personal utility use and reduces exposure risk.

## Repository Notes

This repo is the public project source for Steady and is synced with the build-ready version of the app.

## Release Checklist

- [x] app configured for Expo/EAS
- [x] Android preview build verified
- [x] dependency health check passed
- [x] repo synced to GitHub
- [x] local-only security posture reviewed

## Future Improvements

- add export/import of saved tracking data
- add theme customization
- add habit insights and summary reporting
- add signed production release configuration
