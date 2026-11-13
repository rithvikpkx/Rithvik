import Harness from "./Harness";
import "../windows/lab.css"; // stand-in base tokens + .ui-btn/.ui-ic for the bare lab layout

/** Local harness for the Edit content window. Not linked anywhere; the lab layout is noindex. */
export default function Page() {
  return <Harness />;
}
