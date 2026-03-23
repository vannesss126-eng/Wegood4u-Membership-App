import { Image } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/** Longest edge cap (receipt & selfie uploads). */
export const SUBMISSION_IMAGE_MAX_EDGE = 1000;

const WEBP_QUALITY = 0.82;

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (err) => reject(err ?? new Error('Failed to read image dimensions'))
    );
  });
}

/**
 * Resizes so the longest side is at most SUBMISSION_IMAGE_MAX_EDGE (keeping aspect ratio),
 * then saves as WebP. Images already within the limit are re-encoded to WebP without upscaling.
 */
export async function optimizeSubmissionImage(localUri: string): Promise<string> {
  const { width, height } = await getImageSize(localUri);

  const maxEdge = Math.max(width, height);
  const needsResize = maxEdge > SUBMISSION_IMAGE_MAX_EDGE;

  const actions =
    needsResize
      ? width >= height
        ? [{ resize: { width: SUBMISSION_IMAGE_MAX_EDGE } }]
        : [{ resize: { height: SUBMISSION_IMAGE_MAX_EDGE } }]
      : [];

  const { uri: outUri } = await manipulateAsync(localUri, actions, {
    format: SaveFormat.WEBP,
    compress: WEBP_QUALITY,
  });

  return outUri;
}
