# Steady

Steady is a lightweight daily pouch tracker built with Expo and React Native. It helps you:

- track how many pouches you have in a day
- compare against a personal limit
- estimate the cost based on can size and price
- monitor a timer reminder while you are using it
- review the last 7 days and a monthly/quincena calendar view

## Local run

```bash
npm install
npx expo start
```

## Android build

```bash
npx eas build --profile preview --platform android
```

## Notes

- Data is stored locally on the device using AsyncStorage.
- This app is designed as a private personal utility and is not connected to a remote backend.
- The project is configured for Expo EAS builds and Android APK previews.
