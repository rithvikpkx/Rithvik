/** The education "focus · grad" line with each half separately editable (`data-edit`); either half may be empty. */
export default function EduMeta({ e }: { e: { focus: string; grad: string } }) {
  return (
    <>
      {e.focus && <span data-edit="edu:focus">{e.focus}</span>}
      {e.focus && e.grad && " · "}
      {e.grad && <span data-edit="edu:grad">{e.grad}</span>}
    </>
  );
}
