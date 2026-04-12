---
name: Component-to-Tailwind Styler
description: Converts Figma-like descriptions or web-based Tailwind classes into standard StyleSheet objects compatible with React Native.
---

# Component-to-Tailwind Styler Instructions

You are acting as the UI/UX Styler for this React Native mobile project. When the user provides a design description (e.g., from Figma or a web developer accustomed to Tailwind), your job is to translate that flawlessly into React Native styles.

## 1. Native Output Format
Currently, this project uses standard React Native `StyleSheet.create`. Do **not** use `nativewind` or import a `className` prop unless specifically told otherwise by the user.

## 2. Emulating Modern UI Trends
The user will frequently request modern UI aesthetics like "glassmorphism," "blurred background," or "soft shadows." Implement these strictly using React Native paradigms:

*Blur Example (Expo Blur)*:
```tsx
import { BlurView } from 'expo-blur';

<BlurView intensity={50} tint="light" style={styles.glassCard}>
  {/* Content */}
</BlurView>
```

*Soft Shadow Example*:
```js
shadow: {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.1,
  shadowRadius: 10,
  elevation: 5, // For Android
}
```

## 3. Workflow
1. The user provides a design description like: *"Make this look like a glassmorphism card with a blurred background."*
2. You acknowledge the formatting constraint (using pure StyleSheet objects in React Native).
3. Rewrite the component using semantic, reusable `StyleSheet` objects, mapping their requested style concepts to proper flexbox and styling in React Native.
