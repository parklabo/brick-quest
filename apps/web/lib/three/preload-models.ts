import { useGLTF } from '@react-three/drei';
import { usePlayerStore } from '../stores/player';

const CHARACTER_MODELS = [
  '/models/characters/knight.glb',
  '/models/characters/rogue.glb',
  '/models/characters/mage.glb',
  '/models/characters/barbarian.glb',
  '/models/characters/rogue-hooded.glb',
];

// Preload only the user's selected model immediately
const selectedUrl = usePlayerStore.getState().modelUrl;
useGLTF.preload(selectedUrl);

// Lazy preload remaining models after idle
if (typeof window !== 'undefined') {
  const preloadRest = () => {
    for (const url of CHARACTER_MODELS) {
      if (url !== selectedUrl) {
        useGLTF.preload(url);
      }
    }
  };

  if ('requestIdleCallback' in window) {
    (window as Window).requestIdleCallback(preloadRest);
  } else {
    setTimeout(preloadRest, 3000);
  }
}
