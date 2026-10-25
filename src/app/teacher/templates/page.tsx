'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, CheckCircle2, FileText, AlertCircle } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

interface TemplateField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'dropdown' | 'checkbox';
  required: boolean;
  options?: string[];
}

export default function TemplateBuilderPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [title, setTitle] = useState('Daily Lecture Attendance');
  const [fields, setFields] = useState<TemplateField[]>([
    { id: '1', name: 'rollNo', label: 'Roll Number', type: 'text', required: true },
    { id: '2', name: 'division', label: 'Division / Section', type: 'dropdown', required: true, options: ['Div A', 'Div B', 'Div C'] },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadTemplates = async () => {
    const res = await fetch('/api/templates');
    if (res.ok) {
      const data = await res.json();
      setTemplates(data.templates || []);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const addField = (type: TemplateField['type']) => {
    const id = Date.now().toString();
    const defaultLabels: Record<TemplateField['type'], string> = {
      text: 'Custom Text Field',
      number: 'Numeric Field',
      dropdown: 'Dropdown Selection',
      checkbox: 'Acknowledge Declaration',
    };

    setFields([
      ...fields,
      {
        id,
        name: `field_${id.slice(-4)}`,
        label: defaultLabels[type],
        type,
        required: true,
        ...(type === 'dropdown' ? { options: ['Option 1', 'Option 2'] } : {}),
      },
    ]);
  };

  const removeField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
  };

  const updateField = (id: string, updates: Partial<TemplateField>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, fields }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save template');

      setSuccess('Template saved successfully!');
      loadTemplates();
    } catch (err: any) {
      setError(err.message || 'Error saving template');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadTemplates();
      } else {
        const data = await res.json();
        alert(data.message || 'Cannot delete template in use');
      }
    } catch {
      alert('Failed to delete template');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-teal-200 dark:border-teal-900 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/teacher"
              className="p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-bold text-xl text-slate-900 dark:text-slate-100">Template Builder</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full space-y-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Builder Column */}
          <div className="bg-white dark:bg-slate-900 border border-teal-100 dark:border-teal-900 p-6 rounded-3xl shadow-sm space-y-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Design Template</h2>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {success}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Template Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500 dark:bg-slate-800 dark:text-white"
                placeholder="e.g. CS101 Lecture Attendance"
              />
            </div>

            {/* Field Palette */}
            <div>
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Add Form Field
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => addField('text')}
                  className="px-3 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-teal-50 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Text
                </button>
                <button
                  type="button"
                  onClick={() => addField('number')}
                  className="px-3 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-teal-50 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Number
                </button>
                <button
                  type="button"
                  onClick={() => addField('dropdown')}
                  className="px-3 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-teal-50 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Dropdown
                </button>
                <button
                  type="button"
                  onClick={() => addField('checkbox')}
                  className="px-3 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-teal-50 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Checkbox
                </button>
              </div>
            </div>

            {/* Fields List */}
            <div className="space-y-3 pt-2">
              {fields.map((f, i) => (
                <div
                  key={f.id}
                  className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase text-teal-600 dark:text-teal-400">
                      #{i + 1} &bull; {f.type}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeField(f.id)}
                      className="text-slate-400 hover:text-red-500 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-0.5">Label</label>
                      <input
                        type="text"
                        value={f.label}
                        onChange={(e) => updateField(f.id, { label: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-0.5">Field Key</label>
                      <input
                        type="text"
                        value={f.name}
                        onChange={(e) => updateField(f.id, { name: e.target.value.replace(/\s+/g, '_') })}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  {f.type === 'dropdown' && (
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                        Options (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={f.options?.join(', ') || ''}
                        onChange={(e) =>
                          updateField(f.id, {
                            options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean),
                          })
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-white"
                        placeholder="Option A, Option B, Option C"
                      />
                    </div>
                  )}

                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={f.required}
                      onChange={(e) => updateField(f.id, { required: e.target.checked })}
                      className="rounded text-teal-600 focus:ring-teal-500"
                    />
                    Required field
                  </label>
                </div>
              ))}
            </div>

            <button
              onClick={handleSave}
              disabled={saving || fields.length === 0}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving Template...' : 'Save Template'}
            </button>
          </div>

          {/* Live Preview Column */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-teal-100 dark:border-teal-900 p-6 rounded-3xl shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Live Student Preview
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1 mb-4">
                {title || 'Untitled Form'}
              </h3>

              <div className="space-y-4 p-4 border border-dashed border-teal-200 dark:border-teal-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/30">
                {fields.map((f) => (
                  <div key={f.id}>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {f.label} {f.required && <span className="text-red-500">*</span>}
                    </label>
                    {f.type === 'dropdown' ? (
                      <select disabled className="w-full px-3 py-2 text-xs border rounded-xl bg-white dark:bg-slate-800 text-slate-400">
                        <option>Select...</option>
                        {f.options?.map((opt) => (
                          <option key={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : f.type === 'checkbox' ? (
                      <input type="checkbox" disabled className="h-4 w-4 rounded" />
                    ) : (
                      <input
                        type={f.type}
                        disabled
                        placeholder={`Enter ${f.label.toLowerCase()}`}
                        className="w-full px-3 py-2 text-xs border rounded-xl bg-white dark:bg-slate-800 text-slate-400"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Existing Templates */}
            <div className="bg-white dark:bg-slate-900 border border-teal-100 dark:border-teal-900 p-6 rounded-3xl shadow-sm">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-3">
                Saved Templates ({templates.length})
              </h3>
              <div className="space-y-2">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                        {t.title}
                      </span>
                      <p className="text-[11px] text-slate-400">
                        {(t.fields as any[])?.length || 0} fields &bull; Created{' '}
                        {new Date(t.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteTemplate(t.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500"
                      title="Delete Template"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
