import React from 'react';
import Svg, { Polygon } from 'react-native-svg';

interface StarProps {
  size?: number;
  color?: string;
}

export default function Star({ size = 16, color = '#E5A93D' }: StarProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Polygon points="12 2 15 8 22 9 17 14 18 21 12 18 6 21 7 14 2 9 9 8" />
    </Svg>
  );
}
