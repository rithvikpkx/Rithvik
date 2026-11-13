import Image from "next/image";

export default function EduLogo() {
  return (
    <div className="edu-logo-wrap">
      <Image
        src="/images/purdue.png"
        alt="Purdue University"
        width={38}
        height={38}
        className="edu-logo-img"
      />
    </div>
  );
}
