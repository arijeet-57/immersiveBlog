import { Stars } from '@react-three/drei';

export default function Environment() {
  return (
    <>
      <fog attach="fog" args={['#020410', 40, 220]} />
      <Stars radius={300} depth={50} count={2000} factor={4} fade speed={0.5} />
      {/* Moon — high and to the side; visible at eye-level (Frame B) */}
      <mesh position={[60, 70, -90]}>
        <sphereGeometry args={[6, 32, 32]} />
        <meshBasicMaterial color="#fff6d8" toneMapped={false} />
      </mesh>
      {/* Dark ground plane beneath the flower carpet */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow={false}>
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial color="#040814" toneMapped={false} />
      </mesh>
    </>
  );
}
