import {
  ArrowRight,
  Edit3,
  FolderPlus,
  Grid3X3,
  PlayCircle,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusBanner, type BannerMessage } from '../components/StatusBanner';
import { api } from '../lib/api';
import { formatDisplayDateTime } from '../lib/formatters';
import type { PageId, Simulation } from '../types';

interface SimulationManagerPageProps {
  simulations: Simulation[];
  onRefresh: () => Promise<void>;
  onNavigateWithSim: (page: PageId, simId: number) => void;
}

const PRESET_MODELS: { label: string; name: string; description: string; states: string[] }[] = [
  {
    label: 'Urban–Rural Migration',
    name: 'Urban Growth Model',
    description: 'Tracks population movement between urban centers, rural regions, and migrated cohorts.',
    states: ['Urban Population', 'Rural Population', 'Migrated Population'],
  },
  {
    label: 'Student Academic Standing',
    name: 'University Retention Model',
    description: 'Models annual cohort transitions across undergraduate enrollment stages.',
    states: ['Enrolled', 'Honors Track', 'On Leave', 'Graduated'],
  },
  {
    label: 'Market Share Loyalty',
    name: 'Brand Retention Study',
    description: 'Predicts customer switching behavior across three competing service providers.',
    states: ['Brand A', 'Brand B', 'Brand C'],
  },
];

export function SimulationManagerPage({
  simulations,
  onRefresh,
  onNavigateWithSim,
}: SimulationManagerPageProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [states, setStates] = useState<string[]>(['Urban Population', 'Rural Population', 'Migrated Population']);
  const [newStateInput, setNewStateInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<BannerMessage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Simulation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setStates(['Urban Population', 'Rural Population', 'Migrated Population']);
    setNewStateInput('');
  };

  const handleLoadPreset = (preset: (typeof PRESET_MODELS)[number]) => {
    setEditingId(null);
    setName(preset.name);
    setDescription(preset.description);
    setStates([...preset.states]);
    setBanner({ type: 'info', text: `Loaded "${preset.label}" template. Customize states or click Save Simulation.` });
  };

  const handleAddState = () => {
    const trimmed = newStateInput.trim();
    if (!trimmed) return;
    if (states.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setBanner({ type: 'error', text: `State "${trimmed}" already exists in this simulation.` });
      return;
    }
    setStates([...states, trimmed]);
    setNewStateInput('');
    setBanner(null);
  };

  const handleStateChange = (idx: number, val: string) => {
    const next = [...states];
    next[idx] = val;
    setStates(next);
  };

  const handleRemoveState = (idx: number) => {
    if (states.length <= 2) {
      setBanner({ type: 'error', text: 'A Markov Chain requires at least 2 distinct population states.' });
      return;
    }
    setStates(states.filter((_, i) => i !== idx));
  };

  const handleEditSimulation = (sim: Simulation) => {
    setEditingId(sim.id);
    setName(sim.name);
    setDescription(sim.description);
    setStates([...sim.states]);
    setBanner(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);

    const trimmedName = name.trim();
    const cleanedStates = states.map((s) => s.trim()).filter(Boolean);

    if (!trimmedName) {
      setBanner({ type: 'error', text: 'Please enter a simulation name.' });
      return;
    }
    if (cleanedStates.length < 2) {
      setBanner({ type: 'error', text: 'Please define at least 2 non-empty population states.' });
      return;
    }
    const unique = new Set(cleanedStates.map((s) => s.toLowerCase()));
    if (unique.size !== cleanedStates.length) {
      setBanner({ type: 'error', text: 'All population state names must be unique.' });
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await api.updateSimulation(editingId, {
          name: trimmedName,
          description: description.trim(),
          states: cleanedStates,
        });
        setBanner({ type: 'success', text: `Simulation "${trimmedName}" updated in SQLite.` });
      } else {
        await api.createSimulation({
          name: trimmedName,
          description: description.trim(),
          states: cleanedStates,
        });
        setBanner({ type: 'success', text: `Simulation "${trimmedName}" created and saved to SQLite.` });
      }
      resetForm();
      await onRefresh();
    } catch (err) {
      setBanner({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save simulation.' });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteSimulation(deleteTarget.id);
      if (editingId === deleteTarget.id) resetForm();
      setBanner({
        type: 'success',
        text: `Deleted simulation "${deleteTarget.name}" and its associated matrices and runs.`,
      });
      setDeleteTarget(null);
      await onRefresh();
    } catch (err) {
      setBanner({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete simulation.' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-3xl font-bold text-[#10233F]">
            Simulation Manager
          </h1>
          <p className="mt-1 text-sm text-[#4A463F]">
            Define population models, customize state categories, and manage saved configurations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_MODELS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handleLoadPreset(preset)}
              className="rounded-lg border border-[#D8CFBE] bg-[#FFFCF6] px-3 py-1.5 text-xs font-medium text-[#10233F] hover:border-[#F5A623] hover:bg-[#FAF4E8] transition-colors whitespace-nowrap"
            >
              + {preset.label}
            </button>
          ))}
        </div>
      </div>

      <StatusBanner message={banner} onDismiss={() => setBanner(null)} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Create / Edit Simulation Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 rounded-xl border border-[#E5DEC9] bg-[#FFFCF6] p-6 shadow-[0_2px_10px_rgba(16,35,63,0.05)] space-y-5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FolderPlus className="h-5 w-5 text-[#F5A623]" />
              <h2 className="font-heading text-base font-semibold text-[#10233F]">
                {editingId ? 'Edit Simulation' : 'Create New Simulation'}
              </h2>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-medium text-[#4D83A8] hover:underline"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div>
            <label htmlFor="sim-name" className="block text-xs font-semibold text-[#10233F] mb-1.5">
              Simulation Name *
            </label>
            <input
              id="sim-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Urban Growth Model"
              className="w-full rounded-lg border border-[#D8CFBE] bg-white px-3.5 py-2.5 text-sm text-[#292724] focus:border-[#10233F] focus:outline-none focus:ring-2 focus:ring-[#10233F]/10"
            />
          </div>

          <div>
            <label htmlFor="sim-desc" className="block text-xs font-semibold text-[#10233F] mb-1.5">
              Description
            </label>
            <textarea
              id="sim-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the population system, time horizon, or transition assumptions..."
              className="w-full rounded-lg border border-[#D8CFBE] bg-white px-3.5 py-2 text-sm text-[#292724] focus:border-[#10233F] focus:outline-none focus:ring-2 focus:ring-[#10233F]/10"
            />
          </div>

          {/* Dynamic States Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#10233F]">
                Population States ({states.length})
              </span>
              <span className="text-[11px] text-[#6B655B]">Minimum 2 states</span>
            </div>

            <div className="space-y-2">
              {states.map((st, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-6 text-center text-xs font-semibold text-[#4D83A8] tabular-nums">
                    S{idx + 1}
                  </span>
                  <input
                    type="text"
                    value={st}
                    onChange={(e) => handleStateChange(idx, e.target.value)}
                    placeholder={`State ${idx + 1} name`}
                    className="flex-1 rounded-lg border border-[#D8CFBE] bg-white px-3 py-2 text-sm text-[#292724] focus:border-[#10233F] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveState(idx)}
                    disabled={states.length <= 2}
                    title="Remove state"
                    aria-label={`Remove state ${st}`}
                    className="rounded-lg border border-[#E5DEC9] p-2 text-[#6B655B] hover:bg-[#FEF2F2] hover:text-[#B91C1C] disabled:opacity-40 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                value={newStateInput}
                onChange={(e) => setNewStateInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddState();
                  }
                }}
                placeholder="Add another state name..."
                className="flex-1 rounded-lg border border-[#D8CFBE] bg-white px-3 py-2 text-sm text-[#292724] focus:border-[#4D83A8] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddState}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#4D83A8] bg-[#4D83A8]/10 px-3.5 py-2 text-xs font-semibold text-[#10233F] hover:bg-[#4D83A8] hover:text-white transition-colors whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                Add State
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#10233F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#19335A] transition-colors disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving to SQLite...' : editingId ? 'Update Simulation' : 'Save Simulation'}</span>
          </button>
        </form>

        {/* Right: Saved Simulations List */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-semibold text-[#10233F]">
              Saved Simulations ({simulations.length})
            </h2>
          </div>

          {simulations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D8CFBE] bg-[#FFFCF6] p-10 text-center">
              <p className="font-heading text-sm font-semibold text-[#10233F]">
                No simulations configured yet
              </p>
              <p className="mt-1.5 text-xs text-[#6B655B]">
                Use the form on the left or pick a preset template above to create your first
                population model.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {simulations.map((sim) => (
                <div
                  key={sim.id}
                  className={`rounded-xl border bg-[#FFFCF6] p-5 shadow-[0_2px_8px_rgba(16,35,63,0.04)] transition-colors ${
                    editingId === sim.id ? 'border-[#F5A623] ring-1 ring-[#F5A623]' : 'border-[#E5DEC9]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-heading text-[16px] font-semibold text-[#10233F] truncate">
                        {sim.name}
                      </h3>
                      <p className="mt-1 text-xs text-[#5C574E] leading-relaxed">
                        {sim.description || 'No description provided.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEditSimulation(sim)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#D8CFBE] bg-white px-2.5 py-1.5 text-xs font-medium text-[#10233F] hover:bg-[#F5F0E6] transition-colors"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(sim)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#F5C2C2] bg-white px-2.5 py-1.5 text-xs font-medium text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Clean unboxed metadata + state list */}
                  <div className="mt-3 text-xs text-[#4A463F]">
                    <span className="font-semibold text-[#10233F]">States ({sim.states.length}): </span>
                    <span>{sim.states.join(' · ')}</span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#EFE9DA] flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-[#6B655B] tabular-nums">
                      <span>{sim.matrix_count ?? 0} Matrices</span>
                      <span className="mx-2">&middot;</span>
                      <span>{sim.run_count ?? 0} Runs</span>
                      <span className="mx-2">&middot;</span>
                      <span>Updated {formatDisplayDateTime(sim.updated_at)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onNavigateWithSim('matrix-builder', sim.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5A623] px-3 py-1.5 text-xs font-semibold text-[#10233F] hover:bg-[#E59716] transition-colors whitespace-nowrap"
                      >
                        <Grid3X3 className="h-3.5 w-3.5" />
                        Build Matrix
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigateWithSim('markov-simulator', sim.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#10233F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#19335A] transition-colors whitespace-nowrap"
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                        Simulate
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Simulation"
        message={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? This will also permanently delete its ${deleteTarget.matrix_count ?? 0} transition matrix/matrices and ${deleteTarget.run_count ?? 0} saved simulation run(s) from SQLite.`
            : ''
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
