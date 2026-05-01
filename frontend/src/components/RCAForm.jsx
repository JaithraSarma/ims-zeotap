import { useState } from 'react';
import { submitRCA } from '../services/api';

const ROOT_CAUSE_CATEGORIES = [
  'Infrastructure',
  'Code Bug',
  'Configuration',
  'External Dependency',
  'Capacity',
  'Human Error',
  'Network',
  'Security',
];

export default function RCAForm({ workItemId, existingRCA, onSubmitted }) {
  const [form, setForm] = useState({
    incident_start: existingRCA?.incident_start?.slice(0, 16) || '',
    incident_end: existingRCA?.incident_end?.slice(0, 16) || '',
    root_cause_category: existingRCA?.root_cause_category || '',
    fix_applied: existingRCA?.fix_applied || '',
    prevention_steps: existingRCA?.prevention_steps || '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
    setSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Client-side validation
    if (!form.incident_start || !form.incident_end) {
      return setError('Both incident start and end times are required.');
    }
    if (new Date(form.incident_end) <= new Date(form.incident_start)) {
      return setError('Incident end time must be after start time.');
    }
    if (!form.root_cause_category) {
      return setError('Please select a root cause category.');
    }
    if (!form.fix_applied.trim()) {
      return setError('Fix Applied is required.');
    }
    if (!form.prevention_steps.trim()) {
      return setError('Prevention Steps are required.');
    }

    setSubmitting(true);
    try {
      const rca = {
        incident_start: new Date(form.incident_start).toISOString(),
        incident_end: new Date(form.incident_end).toISOString(),
        root_cause_category: form.root_cause_category,
        fix_applied: form.fix_applied,
        prevention_steps: form.prevention_steps,
      };
      await submitRCA(workItemId, rca);
      setSuccess(true);
      if (onSubmitted) onSubmitted(rca);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="rca-form" onSubmit={handleSubmit}>
      <h3>📝 Root Cause Analysis</h3>

      {error && <div className="rca-error">{error}</div>}
      {success && <div className="rca-success">✅ RCA submitted successfully!</div>}

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="rca-start">Incident Start</label>
          <input
            id="rca-start"
            type="datetime-local"
            name="incident_start"
            value={form.incident_start}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="rca-end">Incident End</label>
          <input
            id="rca-end"
            type="datetime-local"
            name="incident_end"
            value={form.incident_end}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="rca-category">Root Cause Category</label>
        <select
          id="rca-category"
          name="root_cause_category"
          value={form.root_cause_category}
          onChange={handleChange}
          required
        >
          <option value="">Select a category...</option>
          {ROOT_CAUSE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="rca-fix">Fix Applied</label>
        <textarea
          id="rca-fix"
          name="fix_applied"
          value={form.fix_applied}
          onChange={handleChange}
          rows={4}
          placeholder="Describe the fix that was applied to resolve this incident..."
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="rca-prevention">Prevention Steps</label>
        <textarea
          id="rca-prevention"
          name="prevention_steps"
          value={form.prevention_steps}
          onChange={handleChange}
          rows={4}
          placeholder="What steps will be taken to prevent this from happening again?"
          required
        />
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={submitting}
      >
        {submitting ? 'Submitting...' : existingRCA ? 'Update RCA' : 'Submit RCA'}
      </button>
    </form>
  );
}
