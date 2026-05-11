import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3 } from 'three';
import { scrollProgressRef } from '../hooks/useScrollProgress';
import {
  positionCurve,
  lookAtCurve,
  scrollToCurveT,
  easePower2InOut,
} from './spline';

const tmpPos = new Vector3();
const tmpLook = new Vector3();

const LERP_60 = 0.08;

export default function CameraRig() {
  const { camera } = useThree();
  const lookAtRef = useRef(new Vector3(0, 0, 0));

  useFrame((_, dt) => {
    const raw = scrollProgressRef.current;
    const eased = easePower2InOut(raw);
    const t = scrollToCurveT(eased);

    positionCurve.getPoint(t, tmpPos);
    lookAtCurve.getPoint(t, tmpLook);

    const alpha = 1 - Math.pow(1 - LERP_60, dt * 60);
    camera.position.lerp(tmpPos, alpha);
    lookAtRef.current.lerp(tmpLook, alpha);
    camera.lookAt(lookAtRef.current);
  });

  return null;
}
