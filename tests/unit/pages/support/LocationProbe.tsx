import { useLocation } from "react-router-dom";

/** Prints the current URL so a test can read where the page navigated to. */
export function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}
