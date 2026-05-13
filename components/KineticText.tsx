type As = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span";

type Props = React.HTMLAttributes<HTMLElement> & {
  text: string;
  as?: As;
};

/** Each character reacts to hover — bolder when hovered, ripples outward to neighbors. */
export function KineticText({ text, as: Tag = "h1", className = "", style, ...rest }: Props) {
  const mergedStyle = {
    "--hover-padding": "calc(1em / 12)",
    ...(style as React.CSSProperties | undefined),
  } as React.CSSProperties;

  return (
    <Tag
      {...rest}
      className={`flex flex-wrap font-[300] ${className}`}
      style={mergedStyle}
    >
      {text.split("").map((letter, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="[will-change:font-weight,padding] [transition:font-weight_0.15s_cubic-bezier(0.2,0,0,1),padding_0.15s_cubic-bezier(0.2,0,0,1)] hover:[padding-inline:var(--hover-padding)] hover:font-[900] has-[+span+span:hover]:font-[400] has-[+span:hover]:[padding-inline:var(--hover-padding)] has-[+span:hover]:font-[600] [:hover+&]:[padding-inline:var(--hover-padding)] [:hover+&]:font-[600] [:hover+span+&]:font-[400]"
        >
          {letter === " " ? " " : letter}
        </span>
      ))}
      <span className="sr-only">{text}</span>
    </Tag>
  );
}
