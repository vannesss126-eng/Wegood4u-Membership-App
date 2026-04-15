import { useState, useEffect, useCallback } from "react";

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_SUBMISSIONS = [
  { id: "SUB-10042", user: "Ahmad Razif", initials: "AR", shop: "Warung Makan Bakar", submitted_at: "2026-04-14T09:14:00Z", status: "pending", image_s3_key: "proofs/10042.jpg", image_size_kb: 840, location: "Padang, WS", device: "Android 13" },
  { id: "SUB-10089", user: "Siti Norizan", initials: "SN", shop: "Kedai Kopi Lama", submitted_at: "2026-04-14T09:02:00Z", status: "pending", image_s3_key: "proofs/10089.jpg", image_size_kb: 720, location: "Padang, WS", device: "iOS 17" },
  { id: "SUB-10103", user: "Razif Musa", initials: "RM", shop: "Restoran Nasi Lemak", submitted_at: "2026-04-14T08:51:00Z", status: "approved", image_s3_key: "proofs/10103.jpg", image_size_kb: 950, location: "Bukittinggi, WS", device: "Android 14" },
  { id: "SUB-10115", user: "Farah Hanum", initials: "FH", shop: "Kedai Runcit Jaya", submitted_at: "2026-04-14T08:30:00Z", status: "rejected", image_s3_key: "proofs/10115.jpg", image_size_kb: 620, location: "Padang, WS", device: "Android 12" },
  { id: "SUB-10128", user: "Kamal Idris", initials: "KI", shop: "Warung Pak Dollah", submitted_at: "2026-04-14T08:10:00Z", status: "pending", image_s3_key: "proofs/10128.jpg", image_size_kb: 780, location: "Pariaman, WS", device: "iOS 16" },
  { id: "SUB-10134", user: "Nurul Ain", initials: "NA", shop: "Gerai Makan Tok Wi", submitted_at: "2026-04-14T07:55:00Z", status: "pending", image_s3_key: "proofs/10134.jpg", image_size_kb: 890, location: "Solok, WS", device: "Android 13" },
  { id: "SUB-10141", user: "Hafiz Zain", initials: "HZ", shop: "Kopitiam Baru", submitted_at: "2026-04-14T07:40:00Z", status: "approved", image_s3_key: "proofs/10141.jpg", image_size_kb: 540, location: "Padang, WS", device: "Android 14" },
];

// Simulate a presigned URL fetch from your backend
// In real code: POST /api/submissions/:id/presigned-url → returns { url, expires_in: 60 }
async function fetchPresignedUrl(s3Key) {
  await new Promise(r => setTimeout(r, 600)); // simulate network
  return `https://your-bucket.s3.ap-southeast-1.amazonaws.com/${s3Key}?X-Amz-Expires=60&X-Amz-Signature=mock`;
}

// Simulate approve/reject API call
// In real code: PATCH /api/submissions/:id { status: 'approved' | 'rejected' }
async function updateSubmissionStatus(id, status) {
  await new Promise(r => setTimeout(r, 400));
  return { id, status };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

const STATUS_STYLES = {
  pending:  { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B", label: "Pending" },
  approved: { bg: "#D1FAE5", text: "#065F46", dot: "#10B981", label: "Approved" },
  rejected: { bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444", label: "Rejected" },
};

const AVATAR_COLORS = [
  { bg: "#EDE9FE", text: "#5B21B6" },
  { bg: "#DBEAFE", text: "#1E40AF" },
  { bg: "#D1FAE5", text: "#065F46" },
  { bg: "#FEF3C7", text: "#92400E" },
  { bg: "#FCE7F3", text: "#9D174D" },
  { bg: "#E0F2FE", text: "#0C4A6E" },
];

function avatarColor(initials) {
  const idx = initials.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: s.bg, color: s.text,
      fontSize: 11, fontWeight: 600, padding: "3px 9px",
      borderRadius: 20, letterSpacing: "0.02em",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

// ─── Review Modal ─────────────────────────────────────────────────────────────
function ReviewModal({ submission, onClose, onDecision }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [expiresIn, setExpiresIn] = useState(null);

  useEffect(() => {
    let timer;
    setImageLoading(true);
    setImageUrl(null);

    fetchPresignedUrl(submission.image_s3_key).then(url => {
      setImageUrl(url);
      setImageLoading(false);
      setExpiresIn(60);
      // Countdown timer for URL expiry indicator
      timer = setInterval(() => {
        setExpiresIn(prev => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    });

    return () => clearInterval(timer);
  }, [submission.id]);

  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleDecision(status) {
    setActionLoading(status);
    await updateSubmissionStatus(submission.id, status);
    setActionLoading(null);
    onDecision(submission.id, status);
    onClose();
  }

  const av = avatarColor(submission.initials);
  const isPending = submission.status === "pending";

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div style={{
        background: "#fff", borderRadius: 16, width: "100%", maxWidth: 440,
        boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
        overflow: "hidden", animation: "modalIn 0.18s ease",
      }}>
        <style>{`
          @keyframes modalIn { from { opacity:0; transform:translateY(12px) scale(0.97); } to { opacity:1; transform:none; } }
          @keyframes shimmer { from { background-position: -400px 0; } to { background-position: 400px 0; } }
        `}</style>

        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: av.bg, color: av.text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>
              {submission.initials}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>{submission.user}</p>
              <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>{submission.shop}</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StatusBadge status={submission.status} />
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: 4, borderRadius: 6, fontSize: 18, lineHeight: 1, display: "flex" }}
            >✕</button>
          </div>
        </div>

        {/* Image area — loads ONLY now, on demand */}
        <div style={{ position: "relative", background: "#F9FAFB" }}>
          {imageLoading ? (
            <div style={{
              height: 260, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
            }}>
              <div style={{
                width: 180, height: 12, borderRadius: 6,
                background: "linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)",
                backgroundSize: "400px 100%",
                animation: "shimmer 1.2s infinite linear",
              }} />
              <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>Generating secure URL…</p>
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              {/* In production: <img src={imageUrl} ... /> */}
              {/* Here we show a placeholder since we can't load real S3 URLs */}
              <div style={{
                height: 260,
                background: "linear-gradient(135deg, #a7f3d0 0%, #6ee7b7 40%, #34d399 70%, #10b981 100%)",
                display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 6,
              }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="M21 15l-5-5L5 21"/>
                </svg>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.85)" }}>Proof photo — loaded on demand</span>
              </div>

              {/* Expiry indicator */}
              {expiresIn !== null && (
                <div style={{
                  position: "absolute", top: 10, right: 10,
                  background: expiresIn > 20 ? "rgba(0,0,0,0.55)" : "rgba(220,38,38,0.85)",
                  color: "#fff", fontSize: 11, fontWeight: 600,
                  padding: "3px 8px", borderRadius: 20,
                  transition: "background 0.3s",
                }}>
                  URL expires in {expiresIn}s
                </div>
              )}
            </div>
          )}
        </div>

        {/* Metadata */}
        <div style={{ padding: "14px 20px", background: "#F9FAFB", borderTop: "1px solid #F3F4F6", borderBottom: "1px solid #F3F4F6" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
            {[
              ["Submission ID", submission.id],
              ["Image size", `${submission.image_size_kb} KB`],
              ["Location", submission.location],
              ["Device", submission.device],
              ["Submitted", timeAgo(submission.submitted_at)],
              ["S3 key", submission.image_s3_key],
            ].map(([label, value]) => (
              <div key={label}>
                <p style={{ margin: 0, fontSize: 10, color: "#9CA3AF", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#374151", fontWeight: 500, wordBreak: "break-all" }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: "14px 20px", display: "flex", gap: 8 }}>
          {isPending ? (
            <>
              <button
                onClick={() => handleDecision("rejected")}
                disabled={!!actionLoading}
                style={{
                  flex: 1, padding: "10px 0", border: "1.5px solid #FCA5A5",
                  background: actionLoading === "rejected" ? "#FEE2E2" : "#fff",
                  color: "#DC2626", borderRadius: 10, fontSize: 13, fontWeight: 600,
                  cursor: actionLoading ? "not-allowed" : "pointer", transition: "all .15s",
                }}
              >
                {actionLoading === "rejected" ? "Rejecting…" : "Reject"}
              </button>
              <button
                onClick={() => handleDecision("approved")}
                disabled={!!actionLoading}
                style={{
                  flex: 2, padding: "10px 0", border: "none",
                  background: actionLoading === "approved" ? "#059669" : "#10B981",
                  color: "#fff", borderRadius: 10, fontSize: 13, fontWeight: 600,
                  cursor: actionLoading ? "not-allowed" : "pointer", transition: "all .15s",
                }}
              >
                {actionLoading === "approved" ? "Approving…" : "Approve"}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: "10px 0", border: "1.5px solid #E5E7EB",
                background: "#fff", color: "#374151", borderRadius: 10, fontSize: 13,
                fontWeight: 600, cursor: "pointer",
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SubmissionReview() {
  const [submissions, setSubmissions] = useState(MOCK_SUBMISSIONS);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [egressLog, setEgressLog] = useState([]);

  const filtered = submissions.filter(s => {
    const matchStatus = filter === "all" || s.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || s.user.toLowerCase().includes(q) || s.shop.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const counts = {
    all: submissions.length,
    pending: submissions.filter(s => s.status === "pending").length,
    approved: submissions.filter(s => s.status === "approved").length,
    rejected: submissions.filter(s => s.status === "rejected").length,
  };

  function openModal(sub) {
    setSelected(sub);
    // Log egress event — only happens on explicit click, not on table render
    setEgressLog(prev => [{
      time: new Date().toLocaleTimeString(),
      id: sub.id,
      kb: sub.image_size_kb,
    }, ...prev.slice(0, 4)]);
  }

  const handleDecision = useCallback((id, status) => {
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  }, []);

  const totalEgressKB = egressLog.reduce((a, e) => a + e.kb, 0);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: "100vh", background: "#F9FAFB", padding: 24 }}>
      <style>{`
        * { box-sizing: border-box; }
        button:hover { opacity: 0.88; }
        tr:hover td { background: #F9FAFB; }
      `}</style>

      {/* Page header */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>Submission Review</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
            Pattern B — text-only table, images load on demand only
          </p>
        </div>

        {/* Live egress tracker */}
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 14px", minWidth: 200 }}>
          <p style={{ margin: 0, fontSize: 10, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Egress this session</p>
          <p style={{ margin: "3px 0 0", fontSize: 18, fontWeight: 700, color: totalEgressKB > 5000 ? "#DC2626" : "#10B981" }}>
            {totalEgressKB >= 1024 ? `${(totalEgressKB / 1024).toFixed(1)} MB` : `${totalEgressKB} KB`}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9CA3AF" }}>
            {egressLog.length} image{egressLog.length !== 1 ? "s" : ""} loaded
          </p>
        </div>
      </div>

      {/* Filter tabs + search */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {["all", "pending", "approved", "rejected"].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: "1.5px solid",
              borderColor: filter === f ? (f === "pending" ? "#F59E0B" : f === "approved" ? "#10B981" : f === "rejected" ? "#EF4444" : "#6366F1") : "#E5E7EB",
              background: filter === f ? (f === "pending" ? "#FEF3C7" : f === "approved" ? "#D1FAE5" : f === "rejected" ? "#FEE2E2" : "#EEF2FF") : "#fff",
              color: filter === f ? (f === "pending" ? "#92400E" : f === "approved" ? "#065F46" : f === "rejected" ? "#991B1B" : "#4338CA") : "#6B7280",
              cursor: "pointer",
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
          </button>
        ))}
        <input
          type="text"
          placeholder="Search user, shop, ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            marginLeft: "auto", padding: "7px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB",
            fontSize: 12, color: "#374151", background: "#fff", outline: "none", minWidth: 200,
          }}
        />
      </div>

      {/* Table — NO images rendered here */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F9FAFB" }}>
              {["User", "Shop", "Submitted", "Status", "Action"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #F3F4F6" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
                  No submissions found
                </td>
              </tr>
            ) : filtered.map((sub, i) => {
              const av = avatarColor(sub.initials);
              return (
                <tr key={sub.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #F3F4F6" : "none", transition: "background 0.1s" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {/* Avatar initials — zero egress, no image */}
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: av.bg, color: av.text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                        {sub.initials}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, color: "#111827" }}>{sub.user}</p>
                        <p style={{ margin: 0, fontSize: 11, color: "#9CA3AF" }}>{sub.id}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#374151" }}>{sub.shop}</td>
                  <td style={{ padding: "12px 16px", color: "#6B7280", whiteSpace: "nowrap" }}>{timeAgo(sub.submitted_at)}</td>
                  <td style={{ padding: "12px 16px" }}><StatusBadge status={sub.status} /></td>
                  <td style={{ padding: "12px 16px" }}>
                    <button
                      onClick={() => openModal(sub)}
                      style={{
                        padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                        border: "1.5px solid",
                        borderColor: sub.status === "pending" ? "#A78BFA" : "#E5E7EB",
                        background: sub.status === "pending" ? "#EDE9FE" : "#fff",
                        color: sub.status === "pending" ? "#5B21B6" : "#6B7280",
                        cursor: "pointer",
                      }}
                    >
                      {sub.status === "pending" ? "Review" : "View"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Footer */}
        <div style={{ padding: "10px 16px", borderTop: "1px solid #F3F4F6", background: "#F9FAFB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#9CA3AF" }}>{filtered.length} of {submissions.length} submissions</span>
          <span style={{ fontSize: 11, color: "#10B981", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", display: "inline-block" }} />
            0 images loaded on this page — minimal egress
          </span>
        </div>
      </div>

      {/* Egress log */}
      {egressLog.length > 0 && (
        <div style={{ marginTop: 16, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: "12px 16px" }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>Egress log (this session)</p>
          {egressLog.map((e, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6B7280", padding: "3px 0", borderBottom: i < egressLog.length - 1 ? "1px solid #F9FAFB" : "none" }}>
              <span>{e.time} — {e.id}</span>
              <span style={{ fontWeight: 600, color: "#374151" }}>{e.kb} KB</span>
            </div>
          ))}
        </div>
      )}

      {/* Modal — mounts only when a row is clicked */}
      {selected && (
        <ReviewModal
          submission={selected}
          onClose={() => setSelected(null)}
          onDecision={handleDecision}
        />
      )}
    </div>
  );
}