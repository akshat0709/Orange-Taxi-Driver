import React from 'react';
import { Image, ImageProps } from 'react-native';
import { useSignedImageUri } from '../lib/storageUri';

/** <Image> that also loads storage:// references from the private KYC bucket. */
export function SignedImage({ uri, ...rest }: Omit<ImageProps, 'source'> & { uri?: string | null }) {
  const resolved = useSignedImageUri(uri);
  if (!resolved) return null;
  return <Image source={{ uri: resolved }} {...rest} />;
}
