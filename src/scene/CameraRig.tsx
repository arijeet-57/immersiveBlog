import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3 } from 'three';
import { useAppStore } from '../store/appStore';
import { getRouteWaypoint } from '../routes/waypoints';
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
    const { activeRoute, scrollProgress } = useAppStore.getState();
    const waypoint = getRouteWaypoint(activeRoute);

    if (waypoint === null) {
      const eased = easePower2InOut(scrollProgress);
      const t = scrollToCurveT(eased);
      positionCurve.getPoint(t, tmpPos);
      lookAtCurve.getPoint(t, tmpLook);
    } else {
      tmpPos.fromArray(waypoint.position);
      tmpLook.fromArray(waypoint.lookAt);
    }

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
