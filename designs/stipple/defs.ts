// The SVG filter defs: display type and plates are blurred, thresholded against noise and inked, so they read as stippled print.

/** One stipple filter: blur the alpha, subtract noise, threshold to two levels, flood with ink. */
const fz = (id: string, box: string, blur: number, freq: number, seed: number, k2: number, k4: number) =>
  `<filter id="${id}" ${box} color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="${blur}" result="b"/><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="1" seed="${seed}" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="na"/><feComposite in="b" in2="na" operator="arithmetic" k2="${k2}" k3="-1" k4="${k4}" result="d"/><feComponentTransfer in="d" result="t"><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer><feFlood flood-color="#17110E"/><feComposite in2="t" operator="in"/></filter>`;

export const DEFS = `<defs>${[
  fz("st-fz", `x="-15%" y="-25%" width="130%" height="150%"`, 3.4, 0.95, 7, 1.14, 0.02),
  fz("st-fz-s", `x="-10%" y="-30%" width="120%" height="160%"`, 1.3, 1.1, 3, 1.3, 0.04),
  fz("st-fz-m", `x="-15%" y="-20%" width="130%" height="140%"`, 2, 1, 9, 1.3, 0.03),
  fz("st-fz-xs", `x="-10%" y="-30%" width="120%" height="160%"`, 0.6, 1.2, 5, 1.75, 0.02),
  fz("st-fz-art", `x="-20%" y="-20%" width="140%" height="140%"`, 5.5, 0.9, 11, 1.2, 0.04),
].join("")}<filter id="st-seal" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="2" seed="5" result="w"/><feDisplacementMap in="SourceGraphic" in2="w" scale="7" xChannelSelector="R" yChannelSelector="G"/></filter></defs>`;
