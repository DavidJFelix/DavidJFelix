import { useEffect, useState } from "react";

export function Timer({ delay }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((value) => value + 1), delay);
    return () => clearInterval(id);
  }, []);
  return tick;
}
