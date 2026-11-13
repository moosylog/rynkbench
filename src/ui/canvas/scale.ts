// How large a key unit is on screen, for things the canvas sizes in pixels
// (legends, as GLIDE sizes them, stay the same size at every zoom).

import { createContext } from "react";

/** Key units per CSS pixel; GLIDE's 45 px key until the canvas has measured itself. */
export const UnitsPerPixel = createContext(1 / 45);
