# Build Instructions for Smart Routine

## Prerequisites

1. Create an Expo account at https://expo.dev
2. Install EAS CLI: `npm install -g eas-cli`
3. Login: `eas login`

## Build Commands

### 1. Configure EAS Build (run once)

```bash
eas build:configure
```

### 2. Build APK for Play Store

```bash
# For AAB (recommended for Play Store)
eas build --platform android --profile production

# For APK (alternative)
eas build --platform android --profile production-apk
```

### 3. Build for Testing

```bash
# Internal testing APK
eas build --platform android --profile preview
```

## Build Profiles Explained

- **production**: Creates AAB for Play Store upload
- **production-apk**: Creates APK for direct installation
- **preview**: Creates APK for internal testing
- **development**: Creates development build

## After Build Completes

1. Download the build from the provided link
2. Test the APK/AAB thoroughly
3. For Play Store: Use the AAB file
4. For direct sharing: Use the APK file

## Play Store Upload Process

1. Go to Google Play Console
2. Create new app
3. Upload the AAB file
4. Fill in app details using STORE_DESCRIPTIONS.md
5. Add screenshots
6. Set up pricing (free)
7. Submit for review

## Important Notes

- AAB is preferred by Google Play Store
- APK is larger but works for direct installation
- Always test builds before submitting
- Keep build artifacts for future reference
