import { useEffect, useState } from 'react';

/** Local hour and minute, refreshed every 30 seconds. */
export function useClockTime(): { hour: number; minute: number } {
  const read = () => {
    const d = new Date();
    return { hour: d.getHours(), minute: d.getMinutes() };
  };
  const [time, setTime] = useState(read);
  useEffect(() => {
    const id = setInterval(() => {
      const next = read();
      setTime((prev) => (prev.hour === next.hour && prev.minute === next.minute ? prev : next));
    }, 30_000);
    return () => clearInterval(id);
  }, []);
  return time;
}
