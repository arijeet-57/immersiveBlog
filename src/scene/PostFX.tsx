import { EffectComposer, Bloom } from '@react-three/postprocessing';

export default function PostFX() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={0.75}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.4}
        mipmapBlur
      />
    </EffectComposer>
  );
}
