const pkg = require("./package.json");

// Single source of truth for app versioning lives in package.json:
//   "version"     -> marketing version  (iOS CFBundleShortVersionString / Android versionName)
//   "buildNumber" -> native build number (iOS CFBundleVersion / Android versionCode)
// Bump these in package.json; they flow into both platforms from here.
// Requires eas.json -> cli.appVersionSource = "local" for EAS to respect them.
const buildNumber = pkg.buildNumber;

// Local dev points the app at an http:// Supabase
const allowLocalHttp = (process.env.EXPO_PUBLIC_SUPABASE_URL || "").startsWith("http://");

module.exports = {
  expo: {
    name: "Wegood4u",
    slug: "wegood4u-mobile",
    version: pkg.version,
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "wegood4u",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/images/icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "assets/images/**/*.png",
      "assets/images/**/*.jpg",
      "assets/images/**/*.jpeg",
      "assets/images/**/*.webp"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.saysheji.wegood4u",
      buildNumber: String(buildNumber),
      associatedDomains: ["applinks:wegood4u.com"],
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSLocationWhenInUseUsageDescription:
          "Wegood4u uses your location to show nearby partner cafes, restaurants, and travel experiences on the map.",
        NSCameraUsageDescription:
          "Wegood4u needs access to your camera so you can take receipt and selfie photos as travel proof for your visits.",
        NSPhotoLibraryUsageDescription:
          "Wegood4u needs access to your photo library so you can upload receipt and selfie photos as travel proof and update your profile picture.",
        // Dev-only: allow cleartext http to the LOCAL Supabase. Added only when the
        // Supabase URL is http:// (local); production https builds get no exception.
        ...(allowLocalHttp ? { NSAppTransportSecurity: { NSAllowsLocalNetworking: true } } : {})
      }
    },
    android: {
      versionCode: buildNumber,
      package: "com.saysheji.wegood4u",
      // App Links. Scoped to the two auth landing paths ONLY — never the whole
      // host, or the app would swallow /r/<code> and the marketing pages.
      // Each path must have a matching screen in app/, or the OS opens the app
      // to a dead end instead of letting the working website handle it.
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          // Exact `path`, not `pathPrefix`: a prefix would also claim
          // /reset-password/success, which is a web-only screen the app has no
          // route for. Query strings are not part of path matching, so
          // ?token_hash=... still matches.
          data: [
            {
              scheme: "https",
              host: "wegood4u.com",
              path: "/email-confirmed"
            },
            {
              scheme: "https",
              host: "wegood4u.com",
              path: "/reset-password"
            }
          ],
          category: ["BROWSABLE", "DEFAULT"]
        }
      ],
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ""
        }
      }
    },
    androidStatusBar: {
      barStyle: "light-content",
      backgroundColor: "#206E56",
      translucent: false
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      "expo-web-browser",
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Wegood4u uses your location to show nearby partner cafes, restaurants, and travel experiences on the map."
        }
      ]
    ],
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      firebaseMeasurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
      websiteUrl: process.env.EXPO_PUBLIC_WEBSITE_URL,
      resendApiKey: process.env.EXPO_PUBLIC_RESEND_API_KEY,
      jwtSecretKey: process.env.EXPO_PUBLIC_JWT_SECRET_KEY,
      jwtApiKey: process.env.EXPO_PUBLIC_JWT_API_KEY,
      eas: {
        projectId: "b764c837-f472-4d94-89ff-a3800542422c"
      }
    }
  }
};