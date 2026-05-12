export default function Footer() {
  return (
    <footer className="footer">
      <p>© 2026 Rithvik Praveen Kumar.</p>
      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        <p className="footer-sub">Next.js + Supabase + AI</p>
        <a href="/admin/login" className="footer-admin-link">I am Rithvik</a>
      </div>
    </footer>
  );
}
