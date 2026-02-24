'use client';

import { useState, useEffect } from 'react';
import { ref, getDownloadURL, getBlob } from 'firebase/storage';
import { storage } from '../firebase';

export function useStorageUrl(path: string | undefined) {
  const [url, setUrl] = useState<string | undefined>();

  useEffect(() => {
    if (!path) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting state when path becomes undefined is intentional
      setUrl(undefined);
      return;
    }
    let blobUrl: string | undefined;
    const imageRef = ref(storage, path);
    getDownloadURL(imageRef)
      .then(setUrl)
      .catch(() => {
        getBlob(imageRef)
          .then((blob) => {
            blobUrl = URL.createObjectURL(blob);
            setUrl(blobUrl);
          })
          .catch(() => {
            /* non-critical */
          });
      });
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [path]);

  return url;
}
