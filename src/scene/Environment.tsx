import { Stars } from '@react-three/drei';

export default function Environment() {
  return (
    <>
      {/* Blue-hour atmospheric fog: a luminous mid-blue so the gaps
          between distant trunks resolve to glowing haze rather than to
          dark void. Tight near/far range keeps the haze dense. */}
      <fog attach="fog" args={['#4a78b0', 30, 320]} />
      {/* Fewer, fainter stars — blue hour washes most of them out. */}
      <Stars radius={500} depth={80} count={900} factor={3} fade speed={0.4} />
      {/* Cool-blue tinted ground plane — gaps between flowers should read
          as leafy ground in the same mood as the haze. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial color="#0c1b2c" toneMapped={false} />
      </mesh>
    </>
  );
}
