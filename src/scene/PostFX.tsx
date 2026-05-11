import { EffectComposer, Bloom } from '@react-three/postprocessing';

export default function PostFX() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={1.5}
        luminanceThreshold={0.15}
        luminanceSmoothing={0.6}
        mipmapBlur
      />
    </EffectComposer>
  );
}
