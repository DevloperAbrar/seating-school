import { useEffect, useState } from "react";
import axios from "../../api/axios";

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    cloneFromSessionId: "",
    makeActive: true,
  });

  const fetchSessions = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get("/admin/sessions");
      setSessions(res.data.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name || !form.startDate || !form.endDate) {
      setError("Name, start date, and end date are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        startDate: form.startDate,
        endDate: form.endDate,
        makeActive: form.makeActive,
        ...(form.cloneFromSessionId ? { cloneFromSessionId: form.cloneFromSessionId } : {}),
      };
      await axios.post("/admin/sessions", payload);
      setForm({ name: "", startDate: "", endDate: "", cloneFromSessionId: "", makeActive: true });
      setShowForm(false);
      await fetchSessions();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create session");
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (id) => {
    setError("");
    try {
      await axios.put(`/admin/sessions/${id}/activate`);
      await fetchSessions();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to activate session");
    }
  };

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Academic Sessions</h1>
          <p className="text-sm text-gray-500">
            Manage academic years. Only one session can be active at a time — every class, section,
            student, and exam is scoped to the active session.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700"
        >
          {showForm ? "Cancel" : "+ New Session"}
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Session Name *</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. 2026-27"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clone Structure From (optional)</label>
              <select
                name="cloneFromSessionId"
                value={form.cloneFromSessionId}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">None — start fresh</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Copies classes and sections only, not students.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
              <input
                type="date"
                name="startDate"
                value={form.startDate}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
              <input
                type="date"
                name="endDate"
                value={form.endDate}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 mb-4 text-sm text-gray-700">
            <input type="checkbox" name="makeActive" checked={form.makeActive} onChange={handleChange} />
            Make this the active session immediately
          </label>

          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? "Creating..." : "Create Session"}
          </button>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-6 text-center text-gray-500 text-sm">Loading sessions…</div>
        ) : sessions.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            No sessions yet. Create your first academic session to get started.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Start</th>
                <th className="px-4 py-3 font-medium">End</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtDate(s.startDate)}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtDate(s.endDate)}</td>
                  <td className="px-4 py-3">
                    {s.isActive ? (
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
                        Active
                      </span>
                    ) : (
                      <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded-full text-xs font-medium">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!s.isActive && (
                      <button
                        onClick={() => handleActivate(s.id)}
                        className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                      >
                        Activate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
