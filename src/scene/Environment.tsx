import { Stars } from '@react-three/drei';

export default function Environment() {
  return (
    <>
      <fog attach="fog" args={['#020410', 60, 520]} />
      <Stars radius={500} depth={80} count={3200} factor={4} fade speed={0.5} />
      {/* Dark green-tinted ground plane — gaps between flowers should read
          as leafy ground, not pure black. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial color="#06180e" toneMapped={false} />
      </mesh>
    </>
  );
}
