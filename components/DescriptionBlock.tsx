interface Props {
  text: string;
  className?: string;
}

// Renders a description as a bullet list when it has multiple newline-separated
// lines, or a plain paragraph when it's a single line. Project/experience
// descriptions are stored as one bullet per line in the DB.
export default function DescriptionBlock({ text, className }: Props) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  if (lines.length <= 1) {
    return <p className={className}>{text}</p>;
  }

  return (
    <ul className={["desc-bullets", className].filter(Boolean).join(" ")}>
      {lines.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ul>
  );
}
