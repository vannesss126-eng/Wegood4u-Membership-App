// Stub for react-native-maps on web platform
import React from 'react';
import { View } from 'react-native';

// Mock MapView component for web
export const MapView = (props) => {
  return React.createElement(View, {
    ...props,
    style: [
      {
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
      },
      props.style,
    ],
  });
};

// Mock Marker component for web
export const Marker = (props) => {
  return React.createElement(View, props);
};

// Mock Callout component for web
export const Callout = (props) => {
  return React.createElement(View, props);
};

// Default export
export default {
  MapView,
  Marker,
  Callout,
};