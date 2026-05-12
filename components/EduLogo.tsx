"use client";
import { useState } from "react";

export default function EduLogo() {
  const [failed, setFailed] = useState(false);

  return (
    <div className="edu-logo-wrap">
      {failed ? (
        <span className="edu-logo-fallback" style={{ display: "flex" }}>P</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Purdue_University_seal.svg/240px-Purdue_University_seal.svg.png"
          alt="Purdue University"
          className="edu-logo-img"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
