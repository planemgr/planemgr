import { useState, useEffect } from 'react';
import { useReactFlow } from 'reactflow';
import styles from './ZoomIndicator.module.scss';

const ZoomIndicator = () => {
  const { getZoom, setViewport, getViewport } = useReactFlow();
  const [zoom, setZoom] = useState(getZoom());
  const zoomPercentage = Math.round(zoom * 100);

  useEffect(() => {
    const updateZoom = () => {
      setZoom(getZoom());
    };

    // Update zoom on any viewport change
    const interval = setInterval(updateZoom, 100);
    return () => clearInterval(interval);
  }, [getZoom]);

  const handleClick = () => {
    const viewport = getViewport();
    setViewport({ ...viewport, zoom: 1 });
  };

  return (
    <div className={styles.zoomIndicator} onClick={handleClick}>
      {zoomPercentage}%
    </div>
  );
};

export default ZoomIndicator;
