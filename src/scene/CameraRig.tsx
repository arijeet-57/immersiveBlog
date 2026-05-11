import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3 } from 'three';
import { useAppStore } from '../store/appStore';
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
  const firstFrame = useRef(true);

  useFrame((_, dt) => {
    const scrollProgress = useAppStore.getState().scrollProgress;
    const eased = easePower2InOut(scrollProgress);
    const t = scrollToCurveT(eased);
    positionCurve.getPoint(t, tmpPos);
    lookAtCurve.getPoint(t, tmpLook);

    if (firstFrame.current) {
      camera.position.copy(tmpPos);
      lookAtRef.current.copy(tmpLook);
      camera.lookAt(lookAtRef.current);
      firstFrame.current = false;
      return;
    }

    const alpha = 1 - Math.pow(1 - LERP_60, dt * 60);
    camera.position.lerp(tmpPos, alpha);
    lookAtRef.current.lerp(tmpLook, alpha);
    camera.lookAt(lookAtRef.current);
  });

  return null;
}
