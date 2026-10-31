/** Ilustración estática (SVG) del triángulo y las tres órbitas. NO es la escena 3D: es la presentación de emergencia. */
export function StaticArt() {
  return (
    <svg viewBox="0 0 400 320" width="100%" role="img" aria-label="Triángulo central rodeado por tres órbitas" style={{ maxWidth: 520 }}>
      <g fill="none" strokeWidth="1.2" strokeLinecap="round">
        <ellipse cx="200" cy="165" rx="165" ry="62" stroke="#58DDFB" transform="rotate(-12 200 165)" />
        <ellipse cx="200" cy="165" rx="150" ry="112" stroke="#58DDFB" opacity="0.8" transform="rotate(58 200 165)" />
        <ellipse cx="200" cy="165" rx="170" ry="82" stroke="#58DDFB" opacity="0.9" transform="rotate(-48 200 165)" />
      </g>
      <path d="M200 70 L292 232 L108 232 Z M200 112 L256 212 L144 212 Z" fill="#EAEAF1" fillRule="evenodd" stroke="#C8C5D8" strokeWidth="1" />
      <path d="M200 112 L256 212 L144 212 Z" fill="none" stroke="#58DDFB" strokeWidth="1.6" />
    </svg>
  );
}
